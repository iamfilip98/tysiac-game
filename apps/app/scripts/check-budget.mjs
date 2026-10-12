// Initial JS = the entry script + every chunk it modulepreloads. Must stay <= 120 KB gzip (spec §7).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const LIMIT = 120 * 1024;
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const files = new Set([
  ...[...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)].map(m => m[1]),
  ...[...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g)].map(m => m[1]),
]);
let total = 0;
for (const f of files) {
  const size = gzipSync(readFileSync(join(dist, f))).length;
  total += size;
  console.log(`${f}: ${(size / 1024).toFixed(1)} KB gzip`);
}
const eagerLazy = [...files].filter(f => /(^|\/)(Learn|History)-[\w-]+\.js$/.test(f));
if (eagerLazy.length > 0) {
  console.error(`Learn/History must be lazy chunks, but index.html loads: ${eagerLazy.join(', ')}`);
  process.exit(1);
}
const eagerLocale = [...files].filter(f => /(^|\/)(pl|da)-[\w-]+\.js$/.test(f));
if (eagerLocale.length > 0) {
  console.error(`Locale chunks must be lazy, found initial: ${eagerLocale.join(', ')}`);
  process.exit(1);
}
console.log(`initial JS: ${(total / 1024).toFixed(1)} KB gzip (limit ${LIMIT / 1024} KB)`);
if (files.size === 0) {
  console.error('No entry script found in dist/index.html');
  process.exit(1);
}
if (total > LIMIT) {
  console.error('Initial JS budget exceeded');
  process.exit(1);
}
