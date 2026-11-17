-- Boot Camp Commander cloud saves: one save per account, shared across devices.
-- Run this once in the Supabase SQL editor (safe to run again). Needs pgcrypto, which schema.sql enables.
-- Accounts are a username + password (bcrypt-hashed). Logging in returns a random session token;
-- devices keep the token, never the password. Nobody can touch these tables directly, only through
-- the functions below.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.cloud_accounts (
  id          uuid primary key default gen_random_uuid(),
  username    text not null unique check (username ~ '^[a-z0-9_.-]{3,24}$'),
  pass_hash   text not null,
  save_data   jsonb,
  save_rev    bigint not null default 0,
  save_earned double precision not null default 0,
  saved_at    timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.cloud_sessions (
  token_hash  text primary key,
  account_id  uuid not null references public.cloud_accounts(id) on delete cascade,
  device      text not null default '',
  created_at  timestamptz not null default now(),
  last_used   timestamptz not null default now()
);
create index if not exists cloud_sessions_account_idx on public.cloud_sessions (account_id);

alter table public.cloud_accounts enable row level security;  -- no policies: direct access is denied
alter table public.cloud_sessions enable row level security;
revoke all on public.cloud_accounts from anon, authenticated;
revoke all on public.cloud_sessions from anon, authenticated;

-- Creates a session for an account and returns its token.
create or replace function public._cloud_new_session(p_account uuid, p_device text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tok text := encode(gen_random_bytes(32), 'hex');
begin
  insert into public.cloud_sessions (token_hash, account_id, device)
  values (encode(digest(tok, 'sha256'), 'hex'), p_account, left(coalesce(p_device, ''), 60));
  -- Keep at most 10 sessions per account.
  delete from public.cloud_sessions where account_id = p_account and token_hash not in (
    select token_hash from public.cloud_sessions where account_id = p_account order by last_used desc limit 10);
  return tok;
end; $$;
revoke all on function public._cloud_new_session(uuid, text) from public, anon, authenticated;

create or replace function public._cloud_account(p_token text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare acc uuid;
begin
  if p_token is null or char_length(p_token) <> 64 then raise exception 'not signed in'; end if;
  update public.cloud_sessions set last_used = now()
    where token_hash = encode(digest(p_token, 'sha256'), 'hex') returning account_id into acc;
  if acc is null then raise exception 'not signed in'; end if;
  return acc;
end; $$;
revoke all on function public._cloud_account(text) from public, anon, authenticated;

create or replace function public.cloud_signup(p_user text, p_pass text, p_device text default '') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare acc uuid;
begin
  p_user := lower(trim(coalesce(p_user, '')));
  if p_user !~ '^[a-z0-9_.-]{3,24}$' then raise exception 'Usernames are 3-24 letters, numbers, dots, dashes or underscores'; end if;
  if char_length(coalesce(p_pass, '')) < 6 then raise exception 'Passwords need at least 6 characters'; end if;
  if exists (select 1 from public.cloud_accounts where username = p_user) then raise exception 'That username is taken'; end if;
  insert into public.cloud_accounts (username, pass_hash) values (p_user, crypt(p_pass, gen_salt('bf', 10))) returning id into acc;
  return json_build_object('token', public._cloud_new_session(acc, p_device), 'username', p_user, 'rev', 0);
end; $$;

create or replace function public.cloud_login(p_user text, p_pass text, p_device text default '') returns json
language plpgsql security definer set search_path = public, extensions as $$
declare a public.cloud_accounts%rowtype;
begin
  p_user := lower(trim(coalesce(p_user, '')));
  select * into a from public.cloud_accounts where username = p_user;
  if not found or a.pass_hash <> crypt(coalesce(p_pass, ''), a.pass_hash) then raise exception 'Wrong username or password'; end if;
  return json_build_object('token', public._cloud_new_session(a.id, p_device), 'username', a.username,
    'rev', a.save_rev, 'earned', a.save_earned, 'saved_at', a.saved_at, 'has_save', a.save_data is not null);
end; $$;

create or replace function public.cloud_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from public.cloud_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Returns the cloud save. Pass p_have_rev to skip the download when this device already has that revision.
create or replace function public.cloud_pull(p_token text, p_have_rev bigint default -1) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare acc uuid := public._cloud_account(p_token); a public.cloud_accounts%rowtype;
begin
  select * into a from public.cloud_accounts where id = acc;
  return json_build_object('rev', a.save_rev, 'earned', a.save_earned, 'saved_at', a.saved_at, 'username', a.username,
    'data', case when a.save_rev = p_have_rev then null else a.save_data end);
end; $$;

-- Uploads a save. It only replaces the cloud copy when p_base_rev matches the cloud revision (this device
-- was up to date) or p_force is set; otherwise it returns ok=false with the newer cloud save so the device can choose.
create or replace function public.cloud_push(p_token text, p_data jsonb, p_base_rev bigint, p_force boolean default false) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare acc uuid := public._cloud_account(p_token); a public.cloud_accounts%rowtype; e double precision;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'bad save'; end if;
  if pg_column_size(p_data) > 400000 then raise exception 'save too large'; end if;
  select * into a from public.cloud_accounts where id = acc for update;
  if a.save_rev <> coalesce(p_base_rev, -1) and not coalesce(p_force, false) then
    return json_build_object('ok', false, 'rev', a.save_rev, 'earned', a.save_earned, 'saved_at', a.saved_at, 'data', a.save_data);
  end if;
  e := case when jsonb_typeof(p_data->'allEarned') = 'number' then (p_data->>'allEarned')::double precision else 0 end;
  update public.cloud_accounts set save_data = p_data, save_rev = a.save_rev + 1, save_earned = e, saved_at = now() where id = acc;
  return json_build_object('ok', true, 'rev', a.save_rev + 1, 'saved_at', now());
end; $$;

revoke all on function public.cloud_signup(text, text, text) from public;
revoke all on function public.cloud_login(text, text, text) from public;
revoke all on function public.cloud_logout(text) from public;
revoke all on function public.cloud_pull(text, bigint) from public;
revoke all on function public.cloud_push(text, jsonb, bigint, boolean) from public;
grant execute on function public.cloud_signup(text, text, text) to anon, authenticated;
grant execute on function public.cloud_login(text, text, text) to anon, authenticated;
grant execute on function public.cloud_logout(text) to anon, authenticated;
grant execute on function public.cloud_pull(text, bigint) to anon, authenticated;
grant execute on function public.cloud_push(text, jsonb, bigint, boolean) to anon, authenticated;
