import { describe, it, expect } from 'vitest';
import type { GameState } from '../src/types';
import { botAction } from '../src/bot';
import { lowestExpendable, marriageToDeclare, remainingCards } from '../src/bot/play';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { actionsEqual, legalActions, turnOf } from '../src/actions';
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
    const s = scenario({ phase: 'tricks', bid: { high: 'a' }, hands: { a: 'QS KS QH KH 9C 9D AC 10C' } });
    expect(play(s, 'a')).toEqual({ type: 'card', card: c('QH') });
    expect(marriageToDeclare(parseCards('QS KS QH KH'), ['hearts'])).toBe('spades');
  });

  it('defender feeds points to a partner who led strong', () => {
    const s = scenario({
      phase: 'tricks', bid: { high: 'a' }, hands: { a: '9D', b: '9C', c: '10S 9S KD' },
      trick: { leader: 'b', cards: [['b', 'AS']] },
    });
    expect(play(s, 'c')).toEqual({ type: 'card', card: c('10S') });
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

describe('botAction', () => {
  it('always returns a legal, non-pause action', () => {
    for (let g = 0; g < 30; g++) {
      const seats = g % 2 === 0 ? SEATS3 : SEATS4;
      let s = createGame({ seed: `bot-${g}`, seats, maxPlayers: seats.length as 3 | 4, firstDealer: g % seats.length });
      const rand = makeRandom(`bot-rng-${g}`);
      for (let step = 0; step < 400 && s.phase !== 'gameEnd'; step++) {
        const p = turnOf(s)!;
        const action = botAction(viewFor(s, p), rand);
        expect(action.type).not.toBe('pause');
        expect(legalActions(s, p).some(a => actionsEqual(a, action))).toBe(true);
        s = ok(reduce(s, p, action, step)).state;
      }
    }
  });

  it('throws when the viewer has nothing to do', () => {
    const s = createGame({ seed: 'idle', seats: SEATS3, maxPlayers: 3, firstDealer: 2 });
    expect(() => botAction(viewFor(s, 'a'), zero)).toThrow();
  });
});
