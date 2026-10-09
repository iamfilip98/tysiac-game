#!/usr/bin/env node
// Lets `wrangler dev` / `wrangler deploy` run before apps/app exists (milestone 3):
//  - writes a placeholder ../app/dist/index.html when the SPA has not been built yet
//  - writes .dev.vars with a local DEBUG_KEY when missing (gitignored)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const dist = join(root, '..', 'app', 'dist');

if (!existsSync(join(dist, 'index.html'))) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tysiąc</title></head>\n' +
      '<body style="margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui;' +
      'background:#0f3d2e;color:#f5efe0"><p>Tysiąc — the app is coming soon.</p></body></html>\n',
  );
  console.log('ensure-local: wrote placeholder apps/app/dist/index.html');
}

const devVars = join(root, '.dev.vars');
if (!existsSync(devVars)) {
  writeFileSync(devVars, 'DEBUG_KEY=local-debug-key\n');
  console.log('ensure-local: wrote apps/worker/.dev.vars');
}
