import { describe, it, expect } from 'vitest';
import type { Card, Suit, TrickCard } from '../src/types';
import { createDeck, cardEquals, parseCard, parseCards } from '../src/cards';
import { cardRuleMessage, getValidCards, getTrickWinnerWithReason } from '../src/tricks';
import { maxBidFor, nextBidder } from '../src/bidding';

const t = (...pairs: [string, string][]): TrickCard[] => pairs.map(([p, c]) => ({ p, card: parseCard(c) }));

describe('cardRuleMessage', () => {
  it('explains follow-suit', () => {
    expect(cardRuleMessage(parseCards('KH 9S'), t(['a', '10H']), null, parseCard('9S'))).toBe('You must follow ♥');
  });
  it('explains first-responder-must-beat', () => {
    expect(cardRuleMessage(parseCards('AH 9H 9S'), t(['a', '10H']), null, parseCard('9H')))
      .toBe('First to respond must beat 10♥ if you can');
  });
  it('third player only follows suit', () => {
    expect(cardRuleMessage(parseCards('KH 9H'), t(['a', '10H'], ['b', 'AH']), null, parseCard('9H'))).toBeNull();
  });
  it('card not in hand', () => {
    expect(cardRuleMessage(parseCards('KH'), [], null, parseCard('AS'))).toBe("That card isn't in your hand");
  });
  it('agrees with getValidCards on many situations', () => {
    const deck = createDeck();
    const trumps: (Suit | null)[] = [null, 'hearts', 'diamonds', 'clubs', 'spades'];
    let checked = 0;
    for (let i = 0; i < 24; i++) {
      for (let k = 0; k < 24; k += 3) {
        const lead = deck[i];
        const hand: Card[] = [0, 1, 2, 3, 4].map(j => deck[(k + j * 5) % 24]).filter(c => !cardEquals(c, lead));
        const second = deck[(i + 7) % 24];
        const tricks: TrickCard[][] = [[], [{ p: 'x', card: lead }]];
        if (!hand.some(c => cardEquals(c, second))) tricks.push([{ p: 'x', card: lead }, { p: 'y', card: second }]);
        for (const trump of trumps) {
          for (const trick of tricks) {
            const valid = getValidCards(hand, trick, trump);
            for (const c of hand) {
              const legal = valid.some(v => cardEquals(v, c));
              expect(cardRuleMessage(hand, trick, trump, c) === null).toBe(legal);
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

describe('getTrickWinnerWithReason.byTrump', () => {
  it('is true only when a trump beats a non-trump lead', () => {
    expect(getTrickWinnerWithReason(t(['a', 'AH'], ['b', '9S'], ['c', 'KH']), 'spades').byTrump).toBe(true);
    expect(getTrickWinnerWithReason(t(['a', '9S'], ['b', 'AS'], ['c', 'KH']), 'spades').byTrump).toBe(false);
    expect(getTrickWinnerWithReason(t(['a', '9H'], ['b', 'AH'], ['c', 'KH']), null).byTrump).toBe(false);
  });
});

describe('bidding helpers', () => {
  it('maxBidFor is 120 + marriages', () => {
    expect(maxBidFor(parseCards('9H JH'))).toBe(120);
    expect(maxBidFor(parseCards('KH QH KS QS'))).toBe(260);
  });
  it('nextBidder goes clockwise, skipping the high bidder and passed players', () => {
    expect(nextBidder(['a', 'b', 'c'], 'b', 'b', [])).toBe('c');
    expect(nextBidder(['a', 'b', 'c'], 'c', 'c', [])).toBe('a');
    expect(nextBidder(['a', 'b', 'c'], 'a', 'c', ['a'])).toBe('b');
    expect(nextBidder(['a', 'b', 'c'], 'b', 'a', ['b', 'c'])).toBeNull();
  });
});
