import { describe, it, expect } from 'vitest';
import type { Action, PlayerView } from '../src/types';
import { advise as adviseRaw, type AdviseOptions } from '../src/coach';
import { english } from './english';
import { viewFor } from '../src/view';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { actionsEqual, actorsOf } from '../src/actions';
import { botAction } from '../src/bot';
import { makeRandom } from '../src/rng';
import { SEATS3, SEATS4, c, ok, scenario } from './helpers';

interface Advice {
  action: Action;
  headline: string;
  reasons: string[];
}
/** advise() with the structured messages rendered in English (as the app shows them). */
function advise(view: PlayerView, opts?: AdviseOptions): Advice | null {
  const a = adviseRaw(view, opts);
  return a && { action: a.action, headline: english(a.headline, view), reasons: a.reasons.map(r => english(r, view)) };
}

const SUIT_WORDS = /\b(hearts|diamonds|clubs|spades)\b/i;

describe('advise: bidding', () => {
  it('recommends bidding with a strong hand', () => {
    const s = scenario({ phase: 'bidding', hands: { b: 'KH QH AH 10H AS 9C 9D' } });
    const a = advise(viewFor(s, 'b'))!;
    expect(a.action).toEqual({ type: 'bid', amount: 110 });
    expect(a.headline).toBe('Bid 110 — this hand looks worth about 140');
    expect(a.reasons).not.toContain('Bidding up to 10 above the estimate pays off over many hands — the winner takes the talon');
    expect(a.reasons[0]).toBe('Your max bid is 220 (120 + marriages in hand)');
    expect(a.reasons).toContain('K+Q ♥ marriage: +100 when you lead the Q and win a trick');
    expect(a.reasons).toContain('2 aces — 11 points each and usually a trick');
  });
  it('explains passes', () => {
    const over = scenario({ phase: 'bidding', hands: { b: '9S JS 9H JH 9D JD 9C' }, bid: { high: 'a', amount: 120, turn: 'b' } });
    expect(advise(viewFor(over, 'b'))!.headline).toBe("Pass — you can't bid above 120");
    const weak = scenario({ phase: 'bidding', hands: { b: '9H JH 9S JS 9C JC 9D' } });
    expect(advise(viewFor(weak, 'b'))!.headline).toBe('Pass — this hand looks worth about 10, short of 110');
  });
});

describe('advise: decision and hand-out', () => {
  it('play or throw', () => {
    const strong = scenario({ phase: 'decision', bid: { high: 'a', amount: 100 }, hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS' } });
    const a = advise(viewFor(strong, 'a'))!;
    expect(a.action).toEqual({ type: 'play' });
    expect(a.headline).toBe('Play — this hand looks worth about 170, enough for 100');
    const weak = scenario({ phase: 'decision', bid: { high: 'a', amount: 100 }, hands: { a: '9H JH 9S JS 9C JC 9D JD QH QS' } });
    const b = advise(viewFor(weak, 'a'))!;
    expect(b.action).toEqual({ type: 'throw' });
    expect(b.headline).toBe("Throw in — it's free at 100 and this hand looks nearly worthless");
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
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QS KS QH KH 9C 9D JC 10C' } });
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
  it('never feeds points to the other defender: every player scores for themselves', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: '9D', b: '9C', c: '10S 9S KD' },
      trick: { leader: 'b', cards: [['b', 'AS']] },
    });
    const a = advise(viewFor(s, 'c'))!;
    expect(a.headline).toBe('Play 9♠');
    expect(a.reasons).toContain("Bartek is winning — don't add points to an opponent's trick: play your lowest card");
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

describe('advise: research repro positions (M5)', () => {
  const at = (sc: Parameters<typeof scenario>[0], me: string, opts = {}) => advise(viewFor(scenario(sc), me), opts)!;

  it('D1: the bid headline quotes the number the decision used — and passes at 80 instead of bidding 110', () => {
    const a = at({ phase: 'bidding', hands: { b: 'KS QS AH 10H AC 9D 9C' }, bid: { high: 'a', amount: 100, turn: 'b' } }, 'b');
    expect(a.action).toEqual({ type: 'pass' });
    expect(a.headline).toBe('Pass — this hand looks worth about 80, short of 110');
  });

  it('D1: a close bid says so, with the same estimate', () => {
    const a = at({ phase: 'bidding', hands: { b: 'KH QH AH 10H AS 9C 9D' }, bid: { high: 'a', amount: 140, turn: 'b' } }, 'b');
    expect(a.action).toEqual({ type: 'bid', amount: 150 });
    expect(a.headline).toBe('Bid 150 — this hand looks worth about 140, close enough to try');
    expect(a.reasons).toContain('Bidding up to 10 above the estimate pays off over many hands — the winner takes the talon');
  });

  it('D2/D5: above 100 it plays, and says why instead of quoting a losing estimate', () => {
    const a = at({ phase: 'decision', bid: { high: 'a', amount: 140 }, hands: { a: 'KH QH AD 9D JC 9C QC 9S JS 10S' } }, 'a');
    expect(a.action).toEqual({ type: 'play' });
    expect(a.headline).toBe('Play — throwing in at 140 costs 140 too, and gives each opponent 60');
    expect(a.reasons[0]).toBe('This hand looks worth about 110');
    const b = at({ phase: 'decision', bid: { high: 'a', amount: 120 }, hands: { a: 'AH 10H KS QS AD 9D JC 9C QC 9S' } }, 'a');
    expect(b.action).toEqual({ type: 'play' });
    expect(b.headline).toBe('Play — throwing in at 120 costs 120 too, and gives each opponent 60');
  });

  it('D3/D6: no 10 onto the other defender\'s ace while the void bidder can trump it — and no "feed" text', () => {
    const a = at({
      phase: 'tricks', bid: { high: 'c' }, trump: 'hearts', hands: { a: '9H', b: '10S 9S KD', c: 'AH 9H' },
      trick: { leader: 'a', cards: [['a', 'AS']] },
    }, 'b');
    expect(a.action).toEqual({ type: 'card', card: c('9S') });
    expect(a.reasons).toEqual(["Ala is winning — don't add points to an opponent's trick: play your lowest card"]);
  });

  it('D7: last to play with the other defender winning, takes the points', () => {
    const a = at({
      phase: 'tricks', bid: { high: 'b' }, hands: { a: '9H', b: '9D', c: 'AS 10S JS' },
      trick: { leader: 'a', cards: [['a', 'KS'], ['b', '9S']] },
    }, 'c');
    expect(a.action).toEqual({ type: 'card', card: c('10S') });
    expect(a.reasons).toContain('10♠ takes the trick (14 points)');
  });

  it('D8: the bidder leads a low trump, not the 10 into an unseen ace', () => {
    const a = at({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', marriages: { a: ['hearts'] }, tricksWon: { a: ['QH 9C JC'] },
      hands: { a: '10H KH 9H JS 9S QD 9D', b: 'AH', c: 'JH' },
    }, 'a');
    expect(a.action).toEqual({ type: 'card', card: c('9H') });
    expect(a.headline).toBe('Lead 9♥ — draw trumps with a low one and keep your high trumps');
  });

  it('D9: a defender leads a side card, not a trump', () => {
    const a = at({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', hands: { a: 'AH', b: '9H JH 9S JS 9D JD QC', c: '' },
      trick: { leader: 'b', cards: [] },
    }, 'b');
    expect(a.action).toMatchObject({ type: 'card', card: { rank: '9' } });
    expect(a.action.type === 'card' && a.action.card.suit).not.toBe('hearts');
    expect(a.reasons).toContain("Don't lead trumps as a defender — the bidder usually holds most of them");
  });

  it('D4: a lead explains itself by the rule that chose it (no "keeps your aces back" for a hand without aces)', () => {
    const a = at({ phase: 'tricks', bid: { high: 'b' }, trick: { leader: 'a', cards: [] }, hands: { a: '10C KD 9S QS JS 9H JH 9D' } }, 'a');
    expect(a.action).toEqual({ type: 'card', card: c('9S') });
    expect(a.headline).toBe('Lead 9♠ — a low card to give up the lead');
    expect(a.reasons).toEqual(['9♠ is worth 0 points, so losing it costs little']);
  });

  it('D11: never hands out a lone K or Q, and never calls one "least useful"', () => {
    const a = at({ phase: 'handout', bid: { high: 'a', amount: 110 }, hands: { a: 'AH 10H KH QH AS 10S QD JC 9C KC', b: '', c: '' } }, 'a');
    expect(a.headline).toBe('Give J♣ to Bartek and 9♣ to Celina');
    expect(a.reasons).toContain("Don't give away a lone K or Q — it could complete an opponent's marriage");
    const b = at({ phase: 'handout', bid: { high: 'a', amount: 110 }, hands: { a: 'AH 10H KH QH 9H AS QS QD KC 9D', b: '', c: '' } }, 'a');
    expect(b.headline).toBe('Give 9♦ to Bartek and 9♥ to Celina');
  });

  it('D12: after the first card is given, the headline names only the remaining one', () => {
    const sc = {
      phase: 'handout' as const, bid: { high: 'a', amount: 110 }, totals: { a: 0, b: 100, c: 50 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: '', c: '' },
    };
    const a = at(sc, 'a', { handoutGiven: { c: c('9C') } });
    expect(a.headline).toBe('Give 9♦ to Bartek');
    expect(a.action).toEqual({ type: 'handout', to: { b: c('9D'), c: c('9C') } });
    const both = at(sc, 'a', { handoutGiven: { c: c('9C'), b: c('JS') } });
    expect(both.headline).toBe('Confirm: J♠ to Bartek and 9♣ to Celina');
    const best = at(sc, 'a', { handoutGiven: { c: c('9C'), b: c('9D') } });
    expect(best.headline).toBe('Hand out 9♦ to Bartek and 9♣ to Celina — good choice');
  });

  it('I1: confirming a poor hand-out is neutral and warns about marriage halves, aces and tens', () => {
    const sc = {
      phase: 'handout' as const, bid: { high: 'a', amount: 110 }, totals: { a: 0, b: 100, c: 50 },
      hands: { a: 'AH 10H KH QH AS 10S AD 9C 9D JS', b: '', c: '' },
    };
    const a = at(sc, 'a', { handoutGiven: { c: c('KH'), b: c('AS') } });
    expect(a.headline).toBe('Confirm: A♠ to Bartek and K♥ to Celina');
    expect(a.headline).not.toMatch(/good choice/);
    expect(a.reasons).toContain('Giving away K♥ breaks your ♥ marriage — better to give 9♣ and 9♦');
    expect(a.reasons).toContain('Giving away A♠ hands an opponent 11 points — better to give 9♣ and 9♦');
    const t = at(sc, 'a', { handoutGiven: { c: c('10S'), b: c('9D') } });
    expect(t.reasons).toContain('Giving away 10♠ hands an opponent 10 points — better to give 9♣ and 9♦');
  });

  it('M3: the no-throw headline accounts for opponents on the barrel', () => {
    const hands = { a: '9H JH 9S JS 9C JC 9D JD QH QS', b: '', c: '' };
    const base = { phase: 'decision' as const, bid: { high: 'a', amount: 110 }, hands };
    expect(at({ ...base, totals: { a: 0, b: 100, c: 50 } }, 'a').headline).toBe('Play — throwing in at 110 costs 110 too, and gives each opponent 60');
    expect(at({ ...base, totals: { a: 0, b: 850, c: 900 } }, 'a').headline).toBe('Play — throwing in costs 110 too, and opponents on the barrel get nothing');
    expect(at({ ...base, totals: { a: 0, b: 850, c: 50 } }, 'a').headline).toBe('Play — throwing in costs 110 too, and gives Celina 60 (Bartek is on the barrel)');
  });

  it('M4: a lone legal lead says Lead, and lead.cheap does not claim to be the cheapest card', () => {
    const a = at({ phase: 'tricks', bid: { high: 'b' }, trick: { leader: 'a', cards: [] }, hands: { a: '9S', b: '', c: '' } }, 'a');
    expect(a.headline).toBe('Lead 9♠');
    expect(a.reasons).toEqual(["It's your only legal card"]);
  });

  it('P9: cashes side aces before declaring while there is no trump', () => {
    const a = at({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QH KH AS AD AC 10S 9D 9C', b: '', c: '' } }, 'a');
    expect(a.action).toMatchObject({ type: 'card', card: { rank: 'A' } });
    expect(a.headline).toMatch(/^Lead A. — cash your aces while there are no trumps, then declare$/);
    expect(a.reasons).toContain('Your ♥ marriage (+100) can wait until your next lead');
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
        // The coach is the bot: the advice is exactly what a bot would play here.
        expect(a!.action).toEqual(botAction(view, () => 0));
        expect(a!.headline.length).toBeLessThanOrEqual(90);
        expect(a!.reasons.length).toBeGreaterThan(0);
        for (const text of [a!.headline, ...a!.reasons]) {
          expect(text).not.toMatch(SUIT_WORDS);
          expect(text).not.toMatch(/[{}]|undefined|NaN/);
        }
        s = ok(reduce(s, p, botAction(view, rand), step)).state;
      }
    }
  }, 60_000);
});
