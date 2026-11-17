#!/usr/bin/env node
// Runs SQL against the Supabase project through the Management API.
//   node tools/sql.js supabase/sync.sql          run a file
//   node tools/sql.js -e "select count(*) from public.cloud_accounts"
//   npm run sql -- supabase/schema.sql supabase/sync.sql
// Needs a personal access token (https://supabase.com/dashboard/account/tokens), from either
// the SUPABASE_ACCESS_TOKEN env var or a gitignored .env.local in the repo root:
//   SUPABASE_ACCESS_TOKEN=sbp_...
//   SUPABASE_PROJECT_REF=giprzhyfrjphahplveeu   (optional, this is the default)
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function loadEnvFile() {
  const roots = [path.resolve(__dirname, '..')];
  try { // when run from a git worktree, also check the main checkout
    const common = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    roots.push(path.dirname(common));
  } catch {}
  for (const root of roots) {
    const file = path.join(root, '.env.local');
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return;
  }
}

async function run(query, label) {
  const ref = process.env.SUPABASE_PROJECT_REF || 'giprzhyfrjphahplveeu';
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED ${label} (HTTP ${res.status}): ${text}`);
    process.exit(1);
  }
  console.log(`OK ${label}`);
  let rows; try { rows = JSON.parse(text); } catch { rows = text; }
  if (Array.isArray(rows) ? rows.length : rows) console.log(JSON.stringify(rows, null, 2));
}

(async () => {
  loadEnvFile();
  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens and put\n  SUPABASE_ACCESS_TOKEN=sbp_...\nin .env.local at the repo root.');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  if (!args.length) { console.error('Usage: node tools/sql.js <file.sql ...> | -e "<sql>"'); process.exit(1); }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e') { await run(args[++i], 'inline query'); continue; }
    await run(fs.readFileSync(args[i], 'utf8').replace(/^﻿/, ''), args[i]);
  }
})();
