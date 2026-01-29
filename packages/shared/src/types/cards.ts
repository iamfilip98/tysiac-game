// Card suits and ranks for Polish Tysiąc (1000)
// Uses 24-card deck: 9, 10, J, Q, K, A in each suit

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = typeof SUITS[number];

export const RANKS = ['9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Rank = typeof RANKS[number];

export interface Card {
  suit: Suit;
  rank: Rank;
}

// Card point values
export const CARD_POINTS: Record<Rank, number> = {
  '9': 0,
  'J': 2,
  'Q': 3,
  'K': 4,
  '10': 10,
  'A': 11,
} as const;

// Marriage values by suit
export const MARRIAGE_VALUES: Record<Suit, number> = {
  spades: 40,
  clubs: 60,
  diamonds: 80,
  hearts: 100,
} as const;

// Card strength for comparison (higher index = stronger)
export const RANK_STRENGTH: Record<Rank, number> = {
  '9': 0,
  'J': 1,
  'Q': 2,
  'K': 3,
  '10': 4,
  'A': 5,
} as const;

// Utility functions
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getCardPoints(card: Card): number {
  return CARD_POINTS[card.rank];
}

export function getCardStrength(card: Card): number {
  return RANK_STRENGTH[card.rank];
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit[0].toUpperCase()}`;
}

export function parseCard(str: string): Card | null {
  const match = str.match(/^(9|10|J|Q|K|A)([CDHS])$/i);
  if (!match) return null;

  const rank = match[1] as Rank;
  const suitChar = match[2].toUpperCase();
  const suitMap: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
  const suit = suitMap[suitChar];

  return suit ? { suit, rank } : null;
}

export function hasMarriage(hand: Card[], suit: Suit): boolean {
  const hasQueen = hand.some(c => c.suit === suit && c.rank === 'Q');
  const hasKing = hand.some(c => c.suit === suit && c.rank === 'K');
  return hasQueen && hasKing;
}

export function countMarriagesInHand(hand: Card[]): { suit: Suit; value: number }[] {
  const marriages: { suit: Suit; value: number }[] = [];
  for (const suit of SUITS) {
    if (hasMarriage(hand, suit)) {
      marriages.push({ suit, value: MARRIAGE_VALUES[suit] });
    }
  }
  return marriages;
}

export function getTotalMarriageValue(hand: Card[]): number {
  return countMarriagesInHand(hand).reduce((sum, m) => sum + m.value, 0);
}
