#!/usr/bin/env node
// Idempotent production setup + deploy for the `tysiac` Worker (Cloudflare free plan). Steps:
//  1. wrangler must be logged in to ACCOUNT_ID       2. ensure a workers.dev subdomain (API)
//  3. ensure D1 `tysiac` exists, write its id into wrangler.jsonc
//  4. apply D1 migrations remotely                   5. ensure DEBUG_KEY in .secrets.json (gitignored)
//  6. placeholder assets if the app isn't built      7. wrangler deploy --secrets-file  8. live smoke test
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ACCOUNT_ID = '28218e648f55d8177931a703d4da7292';
const WORKER_NAME = 'tysiac';
const DB_NAME = 'tysiac';
const ROOT = join(import.meta.dirname, '..');
const CONFIG = join(ROOT, 'wrangler.jsonc');
const SECRETS = join(ROOT, '.secrets.json');
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}`;
const ENV = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };

function wrangler(args, { quiet = false } = {}) {
  if (!quiet) console.log(`$ wrangler ${args.join(' ')}`);
  // stdin ignored → wrangler runs non-interactively and takes its default answers.
  return execFileSync('pnpm', ['exec', 'wrangler', ...args], { cwd: ROOT, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function apiToken() {
  const out = JSON.parse(wrangler(['auth', 'token', '--json'], { quiet: true }));
  if (!out.token) throw new Error('`wrangler auth token` returned no token — run `wrangler login` first');
  return out.token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok && !(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`Cloudflare API ${method} ${path} → ${res.status}`);
  return res.json();
}

async function ensureSubdomain(token) {
  const current = await api(token, 'GET', '/workers/subdomain');
  if (current.success && current.result?.subdomain) {
    console.log(`workers.dev subdomain: ${current.result.subdomain}`);
    return current.result.subdomain;
  }
  for (const candidate of ['tysiac-1000', 'tysiac-cards', `tysiac-${randomBytes(3).toString('hex')}`]) {
    const put = await api(token, 'PUT', '/workers/subdomain', { subdomain: candidate });
    if (put.success) {
      console.log(`registered workers.dev subdomain: ${put.result.subdomain}`);
      return put.result.subdomain;
    }
    console.warn(`subdomain ${candidate} unavailable: ${JSON.stringify(put.errors)}`);
  }
  throw new Error('could not register a workers.dev subdomain');
}

async function ensureDatabase(token) {
  const find = async () => {
    const list = await api(token, 'GET', `/d1/database?name=${DB_NAME}`);
    if (!list.success) throw new Error(`D1 list failed: ${JSON.stringify(list.errors)}`);
    return list.result.find((d) => d.name === DB_NAME);
  };
  let db = await find();
  if (!db) {
    const created = await api(token, 'POST', '/d1/database', { name: DB_NAME });
    if (!created.success) throw new Error(`D1 create failed: ${JSON.stringify(created.errors)}`);
    console.log(`created D1 database ${DB_NAME}`);
    db = await find();
  }
  if (!db?.uuid) throw new Error('D1 database id not found');
  const config = readFileSync(CONFIG, 'utf8');
  const updated = config.replace(/("database_id":\s*")[^"]*(")/, `$1${db.uuid}$2`);
  if (updated !== config) {
    writeFileSync(CONFIG, updated);
    console.log(`wrangler.jsonc: database_id = ${db.uuid}`);
  }
  return db.uuid;
}

function ensureDebugKey() {
  if (existsSync(SECRETS)) {
    const secrets = JSON.parse(readFileSync(SECRETS, 'utf8'));
    if (secrets.DEBUG_KEY) return;
  }
  writeFileSync(SECRETS, `${JSON.stringify({ DEBUG_KEY: randomBytes(24).toString('hex') }, null, 2)}\n`, { mode: 0o600 });
  console.log(`generated DEBUG_KEY in ${SECRETS} (gitignored)`);
}

async function main() {
  const who = wrangler(['whoami']);
  if (!who.includes(ACCOUNT_ID)) throw new Error(`wrangler is not logged in to account ${ACCOUNT_ID}`);
  const token = apiToken();
  const subdomain = await ensureSubdomain(token);
  await ensureDatabase(token);
  process.stdout.write(wrangler(['d1', 'migrations', 'apply', DB_NAME, '--remote']));
  ensureDebugKey();
  const appDir = join(ROOT, '..', 'app');
  const hasApp = existsSync(join(appDir, 'package.json'));
  if (hasApp) execFileSync('pnpm', ['--filter', '@tysiac/app', 'build'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'ensure-local.mjs')], { stdio: 'inherit' });
  const indexHtml = readFileSync(join(appDir, 'dist', 'index.html'), 'utf8');
  if (indexHtml.includes('tysiac-placeholder')) {
    throw new Error('refusing to deploy: apps/app/dist holds only the placeholder index.html (build the app first)');
  }
  const out = wrangler(['deploy', '--secrets-file', SECRETS]);
  process.stdout.write(out);
  const url = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/)?.[0] ?? `https://${WORKER_NAME}.${subdomain}.workers.dev`;
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'smoke.mjs'), url, ...(hasApp ? ['--require-app'] : [])], { stdio: 'inherit' });
  console.log(`\nLive: ${url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
