// Fails the build when the PWA shell is incomplete.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const fail = msg => {
  console.error(`PWA check failed: ${msg}`);
  process.exit(1);
};
const manifestPath = join(dist, 'manifest.webmanifest');
if (!existsSync(manifestPath)) fail('dist/manifest.webmanifest is missing');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.display !== 'standalone') fail('manifest.display must be "standalone"');
if (!manifest.icons?.some(i => i.sizes === '512x512' && i.purpose === 'maskable')) fail('a maskable 512×512 icon is required');
if (!existsSync(join(dist, 'sw.js'))) fail('dist/sw.js is missing');
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
for (const needle of ['index.html', '.woff2']) if (!sw.includes(needle)) fail(`the service worker does not precache ${needle}`);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const needle of ['apple-touch-icon', 'apple-mobile-web-app-capable', 'manifest.webmanifest', 'viewport-fit=cover']) {
  if (!html.includes(needle)) fail(`index.html lacks ${needle}`);
}
if (!existsSync(join(dist, 'apple-touch-icon-180x180.png'))) fail('apple-touch-icon-180x180.png is missing');
const soundsDir = join(dist, 'sounds');
const sounds = existsSync(soundsDir) ? readdirSync(soundsDir).filter(f => f.endsWith('.m4a')) : [];
if (sounds.length > 0 && !sw.includes('sounds/')) fail('sounds are not precached');
console.log(`PWA check OK (${sounds.length} sounds precached)`);
