import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src/');
const files = (d: string): string[] =>
  readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? (f === 'i18n' ? [] : files(join(d, f))) : [join(d, f)]));

describe('no hard-coded UI text left', () => {
  it('JSX text nodes, aria-labels and titles outside i18n are not English words', () => {
    const bad: string[] = [];
    for (const f of files(SRC).filter(x => x.endsWith('.tsx') && !x.endsWith('.test.tsx'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (
          />\s*[A-Z][a-z]+(\s+[a-z]+)+\s*</.test(line) ||
          /^\s*[A-Z][a-z]+(\s+[a-z]+)+[.…!?]?\s*$/.test(line) ||
          /(aria-label|title|placeholder)="[A-Za-z][a-z]+( [a-z]+)*"/.test(line)
        ) {
          bad.push(`${f.slice(SRC.length)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });
});
