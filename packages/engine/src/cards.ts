import type { Card, Rank, Suit } from './types';
import { RANKS, RULES, SUITS, SUIT_SYMBOL } from './rules';

const SUIT_LETTER: Record<Suit, string> = { clubs: 'C', diamonds: 'D', hearts: 'H', spades: 'S' };
const LETTER_SUIT: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  return deck;
}

export function cardEquals(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** Compact id, e.g. '10D', 'QH'. */
export function cardKey(card: Card): string {
  return `${card.rank}${SUIT_LETTER[card.suit]}`;
}

/** Parses 'KD', '10h', '9S' (rank + suit letter, case-insensitive). Throws on bad input. */
export function parseCard(text: string): Card {
  const m = /^(9|10|J|Q|K|A)([CDHS])$/i.exec(text.trim());
  if (!m) throw new Error(`Bad card: ${text}`);
  return { rank: m[1].toUpperCase() as Rank, suit: LETTER_SUIT[m[2].toUpperCase()] };
}

/** Parses a space-separated list: 'KH QH 9S'. Empty string → []. */
export function parseCards(text: string): Card[] {
  return text.split(/\s+/).filter(Boolean).map(parseCard);
}

/** Human label with suit symbol, e.g. 'K♦'. */
export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

export function cardPoints(card: Card): number {
  return RULES.cardPoints[card.rank];
}

export function handPoints(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + cardPoints(c), 0);
}

export function hasMarriage(hand: readonly Card[], suit: Suit): boolean {
  const hasQueen = hand.some(c => c.suit === suit && c.rank === 'Q');
  const hasKing = hand.some(c => c.suit === suit && c.rank === 'K');
  return hasQueen && hasKing;
}

/** Suits with K+Q in hand, in ♥♦♣♠ order (highest value first). */
export function marriagesInHand(hand: readonly Card[]): Suit[] {
  return RULES.marriageOrder.filter(suit => hasMarriage(hand, suit));
}

export function totalMarriageValue(hand: readonly Card[]): number {
  return marriagesInHand(hand).reduce((sum, suit) => sum + RULES.marriageValues[suit], 0);
}

/** Returns a new hand without `card`. Throws if the card is not in the hand. */
export function removeCard(hand: readonly Card[], card: Card): Card[] {
  const i = hand.findIndex(c => cardEquals(c, card));
  if (i < 0) throw new Error(`Card ${cardKey(card)} not in hand`);
  return [...hand.slice(0, i), ...hand.slice(i + 1)];
}

/** Runtime guard for untrusted input. */
export function isCard(x: unknown): x is Card {
  if (!x || typeof x !== 'object') return false;
  const c = x as { suit?: unknown; rank?: unknown };
  return SUITS.includes(c.suit as Suit) && RANKS.includes(c.rank as Rank);
}
