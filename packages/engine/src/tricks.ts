import type { Card, PlayerId, Suit, TrickCard } from './types';
import { RULES, SUIT_SYMBOL } from './rules';
import { cardEquals, cardLabel, hasMarriage } from './cards';

/**
 * Card play rules for Polish Tysiąc:
 * - All players must follow suit if they can
 * - The FIRST player to respond after the leader must beat the lead card if possible
 * - The remaining player has no obligation to beat — just follow suit
 * - If you can't follow suit, any card is valid (no obligation to trump)
 */

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

const STRENGTH = RULES.rankStrength;

export function canBeat(card: Card, toBeat: Card, _leadSuit: Suit, trumpSuit: Suit | null): boolean {
  if (trumpSuit) {
    if (card.suit === trumpSuit && toBeat.suit !== trumpSuit) return true;
    if (card.suit !== trumpSuit && toBeat.suit === trumpSuit) return false;
    if (card.suit === trumpSuit && toBeat.suit === trumpSuit) {
      return STRENGTH[card.rank] > STRENGTH[toBeat.rank];
    }
  }
  if (card.suit !== toBeat.suit) return false;
  return STRENGTH[card.rank] > STRENGTH[toBeat.rank];
}

export function getHighestCardInTrick(cards: Card[], leadSuit: Suit, trumpSuit: Suit | null): Card {
  let highest = cards[0];
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    if (trumpSuit) {
      if (card.suit === trumpSuit && highest.suit !== trumpSuit) {
        highest = card;
        continue;
      }
      if (card.suit !== trumpSuit && highest.suit === trumpSuit) continue;
      if (card.suit === trumpSuit && highest.suit === trumpSuit) {
        if (STRENGTH[card.rank] > STRENGTH[highest.rank]) highest = card;
        continue;
      }
    }
    if (card.suit === leadSuit && highest.suit === leadSuit) {
      if (STRENGTH[card.rank] > STRENGTH[highest.rank]) highest = card;
    }
  }
  return highest;
}

export interface TrickWinnerResult {
  winnerId: PlayerId;
  winningCard: Card;
  reason: string;
  /** A trump won a trick whose lead suit was not trump. */
  byTrump: boolean;
}

export function getTrickWinnerWithReason(trick: TrickCard[], trumpSuit: Suit | null): TrickWinnerResult {
  const leadSuit = trick[0].card.suit;
  const highestCard = getHighestCardInTrick(trick.map(t => t.card), leadSuit, trumpSuit);
  const winner = trick.find(t => cardEquals(t.card, highestCard))!;
  const isTrump = trumpSuit !== null && highestCard.suit === trumpSuit;
  const isLeadSuit = highestCard.suit === leadSuit;
  let reason: string;
  if (isTrump && !isLeadSuit) reason = `${cardLabel(highestCard)} won by trumping`;
  else if (isTrump && isLeadSuit) reason = `${cardLabel(highestCard)} won as highest trump (trump is lead suit)`;
  else reason = `${cardLabel(highestCard)} won as highest card in lead suit`;
  return { winnerId: winner.p, winningCard: highestCard, reason, byTrump: isTrump && !isLeadSuit };
}

export function getTrickWinner(trick: TrickCard[], trumpSuit: Suit | null): PlayerId {
  return getTrickWinnerWithReason(trick, trumpSuit).winnerId;
}

export function getValidCards(hand: Card[], trick: TrickCard[], trumpSuit: Suit | null): Card[] {
  if (trick.length === 0) return [...hand];
  const leadCard = trick[0].card;
  const leadSuit = leadCard.suit;
  const cardsInSuit = hand.filter(c => c.suit === leadSuit);
  if (cardsInSuit.length === 0) return [...hand];
  // Anyone after the first responder: just follow suit.
  if (trick.length >= 2) return cardsInSuit;
  // First responder: must beat the lead card if possible.
  const beating = cardsInSuit.filter(c => canBeat(c, leadCard, leadSuit, trumpSuit));
  return beating.length > 0 ? beating : cardsInSuit;
}

export function canDeclareMarriage(
  hand: Card[],
  suit: Suit,
  declaredMarriages: Suit[],
  isLeading: boolean,
): ValidationResult {
  if (!isLeading) return { isValid: false, reason: 'Can only declare marriage when leading a trick' };
  if (declaredMarriages.includes(suit)) return { isValid: false, reason: 'Marriage already declared' };
  if (!hasMarriage(hand, suit)) return { isValid: false, reason: 'No marriage in this suit' };
  return { isValid: true };
}

export function validateCardPlay(
  card: Card,
  hand: Card[],
  trick: TrickCard[],
  trumpSuit: Suit | null,
): ValidationResult {
  if (!hand.some(c => cardEquals(c, card))) return { isValid: false, reason: 'Card not in hand' };
  const valid = getValidCards(hand, trick, trumpSuit);
  if (!valid.some(c => cardEquals(c, card))) return { isValid: false, reason: 'Invalid card for current rules' };
  return { isValid: true };
}

/** Friendly reason why `card` cannot be played now, or null if it can. Agrees with getValidCards. */
export function cardRuleMessage(
  hand: Card[],
  trick: TrickCard[],
  trumpSuit: Suit | null,
  card: Card,
): string | null {
  if (!hand.some(c => cardEquals(c, card))) return "That card isn't in your hand";
  if (trick.length === 0) return null;
  const lead = trick[0].card;
  const inSuit = hand.filter(c => c.suit === lead.suit);
  if (inSuit.length > 0 && card.suit !== lead.suit) return `You must follow ${SUIT_SYMBOL[lead.suit]}`;
  if (trick.length === 1 && inSuit.length > 0) {
    const beating = inSuit.filter(c => canBeat(c, lead, lead.suit, trumpSuit));
    if (beating.length > 0 && !beating.some(c => cardEquals(c, card))) {
      return `First to respond must beat ${cardLabel(lead)} if you can`;
    }
  }
  return null;
}
