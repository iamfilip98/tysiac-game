import { RULES, SUIT_SYMBOL, hasMarriage, type Card, type Suit } from '@tysiac/engine';

/** Alternating colours: ♠ ♥ ♣ ♦. */
const SUIT_ORDER: readonly Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort(
    (a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || RULES.rankStrength[b.rank] - RULES.rankStrength[a.rank],
  );
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

/** "♥ 100" on the king of a K+Q pair that has not been declared yet. */
export function marriageTag(card: Card, hand: readonly Card[], declared: readonly Suit[]): string | null {
  if (card.rank !== 'K' || declared.includes(card.suit) || !hasMarriage(hand, card.suit)) return null;
  return `${SUIT_SYMBOL[card.suit]} ${RULES.marriageValues[card.suit]}`;
}

export type CardGlow = 'marriage' | 'trump' | null;

/** Gold: K or Q of an undeclared marriage in hand (wins). Blue: a trump. */
export function glowFor(card: Card, hand: readonly Card[], declared: readonly Suit[], trump: Suit | null): CardGlow {
  if ((card.rank === 'K' || card.rank === 'Q') && !declared.includes(card.suit) && hasMarriage(hand, card.suit)) return 'marriage';
  return trump !== null && card.suit === trump ? 'trump' : null;
}
