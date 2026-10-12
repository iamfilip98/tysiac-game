import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENGINE_MSG_KEYS, msg } from '../src/messages';
import { explainIllegal, viewFor } from '../src/view';
import { reduce } from '../src/reduce';
import { scenario } from './helpers';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const files = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? files(join(d, f)) : [join(d, f)]));

describe('engine messages', () => {
  it('keys are unique', () => expect(new Set(ENGINE_MSG_KEYS).size).toBe(ENGINE_MSG_KEYS.length));

  it('no English prose is left in the engine (only Error() texts for developers)', () => {
    const prose = /(['"`])(?:[A-Z][a-z]+|You|Your)\b[^'"`]*\s[a-z]+[^'"`]*\1/;
    const bad: string[] = [];
    for (const f of files(SRC)) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (/^\s*\*|throw new Error|console\./.test(code)) return;
        if (prose.test(code)) bad.push(`${f.slice(SRC.length)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('msg() omits params when a key has none', () => {
    expect(msg('reject.paused')).toEqual({ key: 'reject.paused' });
    expect(msg('bid.exact', { amount: 110 })).toEqual({ key: 'bid.exact', params: { amount: 110 } });
  });

  it('rule errors and illegal-card reasons are structured', () => {
    const s = scenario({ phase: 'tricks', hands: { a: 'AH KS', b: 'QH 9S', c: '9H JS' }, trick: { leader: 'a', cards: [['a', 'AH']] }, bid: { high: 'a', amount: 100, turn: null } });
    const res = reduce(s, 'b', { type: 'card', card: { suit: 'spades', rank: '9' } }, 1);
    expect(!res.ok && res.error).toEqual({ code: 'illegalCard', msg: { key: 'illegal.mustFollow', params: { suit: { suit: 'hearts' } } } });
    expect(explainIllegal(viewFor(s, 'c'), { suit: 'spades', rank: 'J' })).toEqual({ key: 'illegal.waitFor', params: { player: { player: 'b' } } });
  });
});
