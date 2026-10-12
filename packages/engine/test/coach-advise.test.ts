import { describe, it, expect } from 'vitest';
import type { Advice } from '../src/types';
import { advise } from '../src/coach';
import { viewFor } from '../src/view';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { actionsEqual, actorsOf } from '../src/actions';
import { botAction } from '../src/bot';
import { makeRandom } from '../src/rng';
import { SEATS3, SEATS4, c, ok, scenario } from './helpers';

const SUIT_WORDS = /\b(hearts|diamonds|clubs|spades)\b/i;

describe('advise: bidding', () => {
  it('recommends bidding with a strong hand', () => {
    const s = scenario({ phase: 'bidding', hands: { b: 'KH QH AH 10H AS 9C 9D' } });
    const a = advise(viewFor(s, 'b'))!;
    expect(a.action).toEqual({ type: 'bid', amount: 110 });
    expect(a.headline).toBe('Bid 110 — this hand looks worth about 140');
    expect(a.reasons[0]).toBe('Your max bid is 220 (120 + marriages in hand)');
    expect(a.reasons).toContain('K+Q ♥ marriage: +100 when you lead the Q and win a trick');
    expect(a.reasons).toContain('2 aces — 11 points each and usually a trick');
  });
  it('explains passes', () => {
    const over = scenario({ phase: 'bidding', hands: { b: '9S JS 9H JH 9D JD 9C' }, bid: { high: 'a', amount: 120, turn: 'b' } });
    expect(advise(viewFor(over, 'b'))!.headline).toBe("Pass — you can't bid above 120");
    const weak = scenario({ phase: 'bidding', hands: { b: '9H JH 9S JS 9C JC 9D' } });
    expect(advise(viewFor(weak, 'b'))!.headline).toBe('Pass — 110 is more than this hand is likely to make');
  });
});

describe('advise: decision and hand-out', () => {
  it('play or throw', () => {
    const strong = scenario({ phase: 'decision', bid: { high: 'a', amount: 100 }, hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS' } });
    const a = advise(viewFor(strong, 'a'))!;
    expect(a.action).toEqual({ type: 'play' });
    expect(a.headline).toBe('Play — you can expect about 180 toward your 100');
    const weak = scenario({ phase: 'decision', bid: { high: 'a', amount: 100 }, hands: { a: '9H JH 9S JS 9C JC 9D JD QH QS' } });
    const b = advise(viewFor(weak, 'a'))!;
    expect(b.action).toEqual({ type: 'throw' });
    expect(b.headline).toBe("Throw in — it's free at 100 and this hand looks weak");
    expect(b.reasons[0]).toBe('Throwing at 100 costs nothing: the cards are simply dealt again');
  });
  it('hand-out', () => {
    const s = scenario({
      phase: 'handout', bid: { high: 'a', amount: 100 }, totals: { a: 0, b: 100, c: 50 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: 'KS', c: 'KC' },
    });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.headline).toBe('Give 9♣ to Celina and 9♦ to Bartek');
    expect(a.reasons).toEqual([
      'Giving 9♣ leaves you void in ♣ — you can throw away low cards or trump once a marriage sets a trump suit',
      '9♦ is worth 0 points',
      'Keep your K+Q pairs — each one is a marriage',
      'Keep your aces — they win tricks',
      'The better card goes to Celina, who has the lower score',
    ]);
  });
});

describe('advise: tricks', () => {
  it('leading a Q to declare a marriage', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QS KS QH KH 9C 9D AC 10C' } });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.action).toEqual({ type: 'card', card: c('QH') });
    expect(a.headline).toBe('Lead Q♥ to declare your ♥ marriage');
    expect(a.reasons[0]).toBe('Leading a Q with its K in hand declares the marriage: +100');
  });
  it('first responder must beat', () => {
    const s = scenario({ phase: 'tricks', hands: { a: '9C', b: 'AH 9H 9S', c: 'QC' }, trick: { leader: 'a', cards: [['a', '10H']] } });
    const a = advise(viewFor(s, 'b'))!;
    expect(a.headline).toBe('Play A♥');
    expect(a.reasons).toEqual([
      "It's your only legal card",
      'As first to respond you must beat 10♥ if you can',
      'A♥ beats everything played so far',
    ]);
  });
  it('feeding a partner', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: '9D', b: '9C', c: '10S 9S KD' },
      trick: { leader: 'b', cards: [['b', 'AS']] },
    });
    const a = advise(viewFor(s, 'c'))!;
    expect(a.headline).toBe('Play 10♠');
    expect(a.reasons).toContain('Bartek is winning — 10♠ gives the trick winner 10 points');
  });
});

describe('advise: held marriages', () => {
  const isPair = (card: { suit: string; rank: string }) => card.rank === 'K' || card.rank === 'Q';
  it('(a) leading: declares the Q of the most valuable marriage, never the K', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'KD QD KS QS 9C 9H' } });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.action).toEqual({ type: 'card', card: c('QD') });
    expect(a.headline).toBe('Lead Q♦ to declare your ♦ marriage');
  });
  it('(a) leading with a declared marriage is not restricted', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'diamonds', marriages: { a: ['diamonds'] }, hands: { a: 'KD QD' },
    });
    expect(advise(viewFor(s, 'a'))!.action).toMatchObject({ type: 'card' });
  });
  it('(b) forced to follow the marriage suit: breaks it and says so', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'b' }, hands: { a: 'KD QD 9C', b: '9S', c: '9H' },
      trick: { leader: 'c', cards: [['c', '9D']] },
    });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.action).toMatchObject({ type: 'card', card: { suit: 'diamonds' } });
    const text = a.reasons.join(' | ');
    expect(text).toContain('This gives up your ♦ marriage: it only counts when you lead the Q');
    expect(text).toContain('every legal card here is part of a marriage');
  });
  it('(c) following with a spare legal card: keeps the marriage', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'b' }, hands: { a: 'KS QS 10S', b: '9C', c: '9H' },
      trick: { leader: 'c', cards: [['c', '9S']] },
    });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.action).toEqual({ type: 'card', card: c('10S') });
    expect(a.reasons.join(' ')).not.toContain('gives up');
  });
  it('(c) off-suit: never throws away a K or Q of a held marriage', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'b' }, hands: { a: 'KD QD 9C', b: '9C', c: '9H' },
      trick: { leader: 'c', cards: [['c', '9S']] },
    });
    const a = advise(viewFor(s, 'a'))!;
    expect(a.action).toEqual({ type: 'card', card: c('9C') });
    expect(isPair((a.action as { card: { suit: string; rank: string } }).card)).toBe(false);
  });
});

describe('advise: second responder', () => {
  it('teaches that only the first responder must beat the lead', () => {
    const t = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: '9D', b: 'AS 9C', c: '10S 9S KD' },
      trick: { leader: 'a', cards: [['a', '9S'], ['b', 'KS']] },
    });
    const a = advise(viewFor(t, 'c'))!;
    expect(a.reasons).toContain('You only need to follow suit — only the first player to respond must beat the lead');
  });
});

describe('advise: when silent', () => {
  it('returns null when it is not your turn, when sitting out, or when paused', () => {
    const s = createGame({ seed: 'quiet', seats: SEATS4, maxPlayers: 4, firstDealer: 3 });
    expect(advise(viewFor(s, 'a'))).toBeNull();
    expect(advise(viewFor(s, 'd'))).toBeNull();
    const paused = ok(reduce(s, 'a', { type: 'pause' }, 1)).state;
    expect(advise(viewFor(paused, 'b'))).toBeNull();
  });
});

describe('advise: whole games', () => {
  it('always gives short, legal, symbol-only advice to whoever must act', () => {
    for (let g = 0; g < 20; g++) {
      const seats = g % 2 === 0 ? SEATS3 : SEATS4;
      let s = createGame({ seed: `coach-${g}`, seats, maxPlayers: seats.length as 3 | 4, firstDealer: 0 });
      const rand = makeRandom(`coach-rng-${g}`);
      for (let step = 0; step < 500 && s.phase !== 'gameEnd'; step++) {
        const p = actorsOf(s)[0]!;
        const view = viewFor(s, p);
        const a: Advice | null = advise(view);
        if (s.phase === 'talon') {
          // Confirming the talon needs no advice.
          expect(a).toBeNull();
          s = ok(reduce(s, p, botAction(view, rand), step)).state;
          continue;
        }
        expect(a).not.toBeNull();
        expect(view.legal.some(x => actionsEqual(x, a!.action))).toBe(true);
        expect(a!.headline.length).toBeLessThanOrEqual(90);
        expect(a!.reasons.length).toBeGreaterThan(0);
        for (const text of [a!.headline, ...a!.reasons]) expect(text).not.toMatch(SUIT_WORDS);
        s = ok(reduce(s, p, botAction(view, rand), step)).state;
      }
    }
  });
});
