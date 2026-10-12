import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/types';
import { botAction, botShouldAct } from '../src/bot';
import { lowestExpendable, marriageToDeclare, remainingCards } from '../src/bot/play';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { actionsEqual, actorsOf, legalActions, turnOf } from '../src/actions';
import { viewFor } from '../src/view';
import { makeRandom } from '../src/rng';
import { parseCards } from '../src/cards';
import { SEATS3, SEATS4, c, ok, scenario } from './helpers';

const zero = () => 0;
const play = (s: GameState, p: string) => botAction(viewFor(s, p), zero);

describe('bot card play', () => {
  it('bidder leads the non-trump ace of the suit with most outstanding points', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AS AD KD 10D 9C 9H JS QS' } });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('AS') });
  });

  it('leads the Q of the most valuable undeclared marriage', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QS KS QH KH 9C 9D JC 10C' } });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('QH') });
    expect(marriageToDeclare(parseCards('QS KS QH KH'), ['hearts'])).toBe('spades');
  });

  it('defender never feeds points to the other defender (every player scores for themselves)', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: '9D', b: '9C', c: '10S 9S KD' },
      trick: { leader: 'b', cards: [['b', 'AS']] },
    });
    expect(play(s, 'c')).toEqual({ type: 'card', card: c('9S') });
  });

  it('bidder follows with the cheapest winning card', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AD 10D 9D 9S', b: '9C', c: '9H' },
      trick: { leader: 'c', cards: [['c', 'KD']] },
    });
    expect(turnOf(s)).toBe('a');
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('10D') });
  });

  it('defender trumps the bidder when the trick is worth it', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'spades', hands: { a: '9D', b: '9S JC QC', c: '9H' },
      trick: { leader: 'a', cards: [['a', 'AH']] },
    });
    expect(play(s, 'b')).toEqual({ type: 'card', card: c('9S') });
  });

  it('helpers: lowestExpendable keeps aces and protected tens; remainingCards', () => {
    expect(lowestExpendable(parseCards('AS 10S 9H KC'), null)).toEqual(c('9H'));
    expect(remainingCards(parseCards('AH'), parseCards('KH'))).toHaveLength(22);
  });
});

describe('research repro positions (M5 coach)', () => {
  it('D3/D6: no 10 onto the other defender\'s ace while the void bidder can still trump it', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'c' }, trump: 'hearts', hands: { a: '9H', b: '10S 9S KD', c: 'AH 9H' },
      trick: { leader: 'a', cards: [['a', 'AS']] },
    });
    expect(play(s, 'b')).toEqual({ type: 'card', card: c('9S') });
  });

  it('D7: last to play, the other defender winning: takes the points itself', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'b' }, hands: { a: '9H', b: '9D', c: 'AS 10S JS' },
      trick: { leader: 'a', cards: [['a', 'KS'], ['b', '9S']] },
    });
    expect(play(s, 'c')).toEqual({ type: 'card', card: c('10S') });
  });

  it('F4: a void defender trumps the bidder\'s trick once it holds 4+ points', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', hands: { a: '9C', b: '9H 9D JD', c: 'JC' },
      trick: { leader: 'a', cards: [['a', 'KS']] },
    });
    expect(play(s, 'b')).toEqual({ type: 'card', card: c('9H') });
  });

  it('D8: bidder never leads the 10 of trumps into an unseen ace', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', marriages: { a: ['hearts'] }, tricksWon: { a: ['QH 9C JC'] },
      hands: { a: '10H KH 9H JS 9S QD 9D', b: 'AH', c: 'JH' },
    });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('9H') });
  });

  it('D8: bidder holding the top trump leads it', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', marriages: { a: ['hearts'] },
      tricksWon: { a: ['QH 9C JC', 'AH 9D JD'] }, hands: { a: '10H KH 9H JS 9S QD', b: 'JH', c: '9C' },
    });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('10H') });
  });

  it('D9: a defender does not lead trumps while holding a side card', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'hearts', hands: { a: 'AH', b: '9H JH 9S JS 9D JD QC', c: '' },
      trick: { leader: 'b', cards: [] },
    });
    const action = play(s, 'b');
    expect(action.type === 'card' && action.card.suit).not.toBe('hearts');
  });

  it('D4: a defender giving up the lead does not lead a lone 10 into an unseen ace', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'b' }, trick: { leader: 'a', cards: [] }, hands: { a: '10C JD', b: '9H', c: '9S' } });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('JD') });
  });

  it('P9: bidder cashes side aces while there is no trump, then declares the marriage', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QH KH AS AD AC 10S 9D 9C' } });
    const first = play(s, 'a');
    expect(first.type === 'card' && first.card.rank).toBe('A');
    const noAces = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QH KH 10S 9D 9C' } });
    expect(play(noAces, 'a')).toEqual({ type: 'card', card: c('QH') });
    // Once a trump exists the ace could be trumped: declare straight away.
    const trumped = scenario({
      phase: 'tricks', bid: { high: 'a' }, trump: 'spades', marriages: { a: ['spades'] }, hands: { a: 'QH KH AD 9C' },
    });
    expect(play(trumped, 'a')).toEqual({ type: 'card', card: c('QH') });
  });
});

describe('botAction', () => {
  it('always returns a legal, non-pause action', () => {
    for (let g = 0; g < 30; g++) {
      const seats = g % 2 === 0 ? SEATS3 : SEATS4;
      let s = createGame({ seed: `bot-${g}`, seats, maxPlayers: seats.length as 3 | 4, firstDealer: g % seats.length });
      const rand = makeRandom(`bot-rng-${g}`);
      for (let step = 0; step < 400 && s.phase !== 'gameEnd'; step++) {
        const p = actorsOf(s)[0]!;
        const action = botAction(viewFor(s, p), rand);
        expect(action.type).not.toBe('pause');
        expect(legalActions(s, p).some(a => actionsEqual(a, action))).toBe(true);
        s = ok(reduce(s, p, action, step)).state;
      }
    }
  }, 60_000);

  it('throws when the viewer has nothing to do', () => {
    const s = createGame({ seed: 'idle', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    expect(() => botAction(viewFor(s, 'a'), zero)).toThrow();
  });
});

describe('botAction contract', () => {
  it('botShouldAct is true on a normal bot turn', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AS AD KD 10D 9C 9H JS QS' } });
    const p = turnOf(s)!;
    expect(botShouldAct(viewFor(s, p))).toBe(true);
    expect(() => botAction(viewFor(s, p), zero)).not.toThrow();
  });

  it('throws and botShouldAct is false when it is not the viewer\'s turn', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AS AD KD 10D 9C 9H JS QS' } });
    const other = SEATS3.map(x => x.id).find(id => id !== turnOf(s))!;
    expect(botShouldAct(viewFor(s, other))).toBe(false);
    expect(() => botAction(viewFor(s, other), zero)).toThrow();
  });

  it('throws and botShouldAct is false when paused', () => {
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AS AD KD 10D 9C 9H JS QS' } });
    const p = turnOf(s)!;
    const paused = ok(reduce(s, p, { type: 'pause' }, 1)).state;
    expect(botShouldAct(viewFor(paused, p))).toBe(false);
    expect(() => botAction(viewFor(paused, p), zero)).toThrow();
  });

  it('throws and botShouldAct is false at gameEnd', () => {
    const s = { ...scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'AS' } }), phase: 'gameEnd' as const };
    const p = SEATS3[0].id;
    expect(botShouldAct(viewFor(s, p))).toBe(false);
    expect(() => botAction(viewFor(s, p), zero)).toThrow();
  });
});
