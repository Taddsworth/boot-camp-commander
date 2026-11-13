-- Boot Camp Commander global leaderboard.
-- Players can read everyone's scores and submit their own through submit_score().
-- Nobody can write the table directly; each player's row is protected by a secret only their device knows.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.scores (
  player_id     uuid primary key,
  secret_hash   text not null,
  name          text not null check (char_length(name) between 1 and 20),
  base_name     text not null default '' check (char_length(base_name) <= 28),
  career_earned double precision not null default 0 check (career_earned >= 0 and career_earned < 1e80),
  graduates     double precision not null default 0 check (graduates >= 0 and graduates < 1e80),
  rank_index    int not null default 0 check (rank_index between 0 and 20),
  stars         bigint not null default 0 check (stars >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists scores_earned_idx on public.scores (career_earned desc);
create index if not exists scores_grads_idx  on public.scores (graduates desc);

alter table public.scores enable row level security;   -- no policies: direct table access is denied
revoke all on public.scores from anon, authenticated;

-- Public read-only view without the secret.
create or replace view public.leaderboard as
  select player_id, name, base_name, career_earned, graduates, rank_index, stars, updated_at
  from public.scores;
revoke all on public.leaderboard from anon, authenticated;
grant select on public.leaderboard to anon, authenticated;

create or replace function public.submit_score(
  p_player uuid, p_secret text, p_name text, p_base text,
  p_earned double precision, p_grads double precision, p_rank int, p_stars bigint
) returns void
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  existing public.scores%rowtype;
  h text;
begin
  if p_player is null or p_secret is null or char_length(p_secret) < 16 then raise exception 'invalid player'; end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  p_name := left(regexp_replace(trim(coalesce(p_name, '')), '[[:cntrl:]<>]', '', 'g'), 20);
  p_base := left(regexp_replace(trim(coalesce(p_base, '')), '[[:cntrl:]<>]', '', 'g'), 28);
  if char_length(p_name) < 1 then raise exception 'name required'; end if;
  if p_earned is null or p_earned <> p_earned or p_earned < 0 or p_earned >= 1e80 then raise exception 'bad score'; end if;
  if p_grads is null or p_grads <> p_grads or p_grads < 0 or p_grads >= 1e80 then raise exception 'bad score'; end if;
  p_rank := least(greatest(coalesce(p_rank, 0), 0), 20);
  p_stars := greatest(coalesce(p_stars, 0), 0);

  select * into existing from public.scores where player_id = p_player;
  if found then
    if existing.secret_hash <> h then raise exception 'not your score'; end if;
    if existing.updated_at > now() - interval '10 seconds' then return; end if;  -- rate limit
    update public.scores set
      name = p_name, base_name = p_base,
      career_earned = greatest(existing.career_earned, p_earned),           -- keeps the career best
      graduates     = greatest(existing.graduates, p_grads),
      rank_index    = greatest(existing.rank_index, p_rank),
      stars         = greatest(existing.stars, p_stars),
      updated_at    = now()
    where player_id = p_player;
  else
    insert into public.scores (player_id, secret_hash, name, base_name, career_earned, graduates, rank_index, stars)
    values (p_player, h, p_name, p_base, p_earned, p_grads, p_rank, p_stars);
  end if;
end;
$$;
revoke all on function public.submit_score(uuid, text, text, text, double precision, double precision, int, bigint) from public;
grant execute on function public.submit_score(uuid, text, text, text, double precision, double precision, int, bigint) to anon, authenticated;
