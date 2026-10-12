#!/usr/bin/env node
// Live smoke test. Usage: node scripts/smoke.mjs https://tysiac.<subdomain>.workers.dev
// Checks: create room → lookup → WebSocket hello/welcome → debug endpoint (if key known) → history → SPA.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2]?.replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/smoke.mjs <base-url>');
  process.exit(2);
}
const secretsPath = join(import.meta.dirname, '..', '.secrets.json');
const debugKey = existsSync(secretsPath) ? JSON.parse(readFileSync(secretsPath, 'utf8')).DEBUG_KEY : process.env.DEBUG_KEY;

async function retry(label, fn, tries = 24, delayMs = 5000) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries) throw new Error(`${label}: ${err.message}`);
      console.log(`${label}: ${err.message} — retrying (${i}/${tries})`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

const playerId = randomUUID();
const secret = randomUUID();

const { code } = await retry('POST /api/rooms', async () => {
  const res = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ maxPlayers: 3, playerId, name: 'Smoke', avatar: '🧪' }),
  });
  if (res.status !== 200) throw new Error(`status ${res.status}: ${await res.text()}`);
  return res.json();
});
console.log(`✓ POST /api/rooms → ${code}`);

const exists = await retry('GET /api/rooms/:code', async () => {
  const res = await fetch(`${base}/api/rooms/${code}`);
  if (!(res.headers.get('content-type') ?? '').includes('json')) throw new Error(`status ${res.status}, not JSON (still propagating?)`);
  return res.json();
});
if (!exists.exists || exists.status !== 'lobby' || exists.seatsTaken !== 1) throw new Error(`lookup failed: ${JSON.stringify(exists)}`);
console.log('✓ GET /api/rooms/:code');

const welcome = await new Promise((resolve, reject) => {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ws/${code}`);
  const timer = setTimeout(() => reject(new Error('no welcome within 10 s')), 10_000);
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', v: 1, playerId, secret, name: 'Smoke', avatar: '🧪', coach: false }));
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.t === 'welcome') {
      clearTimeout(timer);
      ws.close(1000, 'smoke done');
      resolve(msg);
    } else if (msg.t === 'error') {
      clearTimeout(timer);
      reject(new Error(`${msg.code}: ${msg.message}`));
    }
  };
  ws.onerror = () => {
    clearTimeout(timer);
    reject(new Error('socket error'));
  };
});
if (welcome.you !== playerId || welcome.room.seats[0].id !== playerId) throw new Error(`bad welcome: ${JSON.stringify(welcome)}`);
console.log('✓ WebSocket hello → welcome');

if (debugKey) {
  const res = await fetch(`${base}/api/debug/rooms/${code}`, { headers: { 'x-debug-key': debugKey } });
  if (res.status !== 200) throw new Error(`debug endpoint returned ${res.status}`);
  const denied = await fetch(`${base}/api/debug/rooms/${code}`);
  if (denied.status !== 404) throw new Error(`debug endpoint without key returned ${denied.status}`);
  console.log('✓ GET /api/debug/rooms/:code (404 without key, 200 with key)');
} else {
  console.log('… skipped debug check (no .secrets.json / DEBUG_KEY)');
}

const history = await fetch(`${base}/api/history?player=${playerId}`);
if (history.status !== 200) throw new Error(`history returned ${history.status}`);
console.log('✓ GET /api/history');

const spa = await fetch(`${base}/r/${code}`);
if (spa.status !== 200 || !(await spa.text()).includes('<html')) throw new Error(`SPA fallback returned ${spa.status}`);
console.log('✓ GET /r/:code serves the SPA shell');

console.log(`SMOKE OK ${base}`);
