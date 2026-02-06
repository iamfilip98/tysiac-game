import type { Card, Suit, GameState, TrickState } from '@tysiac/shared';
import { RANK_STRENGTH, getTotalMarriageValue, hasMarriage } from '@tysiac/shared';

/**
 * Card play validation for Polish Tysiąc:
 * - All players must follow suit if they can
 * - Must beat highest card if possible when following suit
 * - If can't follow suit, must trump if possible
 */

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export function getValidCards(
  hand: Card[],
  trick: TrickState,
  trumpSuit: Suit | null,
  _game: GameState
): Card[] {
  // If first to play, any card is valid
  if (trick.cards.length === 0) {
    return [...hand];
  }

  const leadSuit = trick.leadSuit!;
  const leadCard = trick.cards[0].card;

  // Get highest card played so far
  const highestCard = getHighestCardInTrick(trick.cards.map(c => c.card), leadSuit, trumpSuit);

  // Check if lead card is still winning
  const leadIsWinning =
    highestCard.suit === leadCard.suit &&
    highestCard.rank === leadCard.rank;

  // Only beat the lead if it's currently winning; otherwise just follow suit
  const cardToBeat = leadIsWinning ? leadCard : null;

  return getCardsFollowingStandardRules(hand, leadSuit, trumpSuit, cardToBeat);
}

function getCardsFollowingStandardRules(
  hand: Card[],
  leadSuit: Suit,
  trumpSuit: Suit | null,
  cardToBeat: Card | null  // null = just follow suit (lead already beaten)
): Card[] {
  const cardsInSuit = hand.filter(c => c.suit === leadSuit);

  // Must follow suit if possible
  if (cardsInSuit.length > 0) {
    // Only need to beat if there's a card to beat (lead is still winning)
    if (cardToBeat) {
      const beatingCards = cardsInSuit.filter(c =>
        canBeat(c, cardToBeat, leadSuit, trumpSuit)
      );

      if (beatingCards.length > 0) {
        return beatingCards;
      }
    }
    // No card to beat OR can't beat - just follow suit
    return cardsInSuit;
  }

  // Can't follow suit - player can play any card (no trump obligation)
  return [...hand];
}

export function canBeat(
  card: Card,
  toBeat: Card,
  leadSuit: Suit,
  trumpSuit: Suit | null
): boolean {
  // Trump beats non-trump
  if (trumpSuit) {
    if (card.suit === trumpSuit && toBeat.suit !== trumpSuit) {
      return true;
    }
    if (card.suit !== trumpSuit && toBeat.suit === trumpSuit) {
      return false;
    }
    // Both trump or neither trump
    if (card.suit === trumpSuit && toBeat.suit === trumpSuit) {
      return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
    }
  }

  // Must be same suit to beat
  if (card.suit !== toBeat.suit) {
    return false;
  }

  return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
}

export function getHighestCardInTrick(
  cards: Card[],
  leadSuit: Suit,
  trumpSuit: Suit | null
): Card {
  let highest = cards[0];

  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];

    // Trump always wins over non-trump
    if (trumpSuit) {
      if (card.suit === trumpSuit && highest.suit !== trumpSuit) {
        highest = card;
        continue;
      }
      if (card.suit !== trumpSuit && highest.suit === trumpSuit) {
        continue;
      }
      // Both trump
      if (card.suit === trumpSuit && highest.suit === trumpSuit) {
        if (RANK_STRENGTH[card.rank] > RANK_STRENGTH[highest.rank]) {
          highest = card;
        }
        continue;
      }
    }

    // Only lead suit cards can win (if no trump)
    if (card.suit === leadSuit && highest.suit === leadSuit) {
      if (RANK_STRENGTH[card.rank] > RANK_STRENGTH[highest.rank]) {
        highest = card;
      }
    }
  }

  return highest;
}

export function getTrickWinner(
  trick: TrickState,
  trumpSuit: Suit | null
): string {
  const leadSuit = trick.leadSuit!;
  const highestCard = getHighestCardInTrick(
    trick.cards.map(c => c.card),
    leadSuit,
    trumpSuit
  );

  const winner = trick.cards.find(c =>
    c.card.suit === highestCard.suit && c.card.rank === highestCard.rank
  );

  return winner!.playerId;
}

export function validateBid(
  amount: number,
  currentBid: number,
  hand: Card[],
  isFirstBid: boolean
): ValidationResult {
  // Bids must increase by exactly 10 each time
  const requiredBid = currentBid + 10;

  if (amount !== requiredBid) {
    return { isValid: false, reason: `Bid must be exactly ${requiredBid} (current bid + 10)` };
  }

  // Max bid is 120 + marriage value in hand
  const marriageValue = getTotalMarriageValue(hand);
  const maxBid = 120 + marriageValue;

  if (amount > maxBid) {
    return { isValid: false, reason: `Maximum bid is ${maxBid} (120 + ${marriageValue} from marriages)` };
  }

  return { isValid: true };
}

export function canDeclareMarriage(
  hand: Card[],
  suit: Suit,
  declaredMarriages: Suit[],
  isLeading: boolean
): ValidationResult {
  if (!isLeading) {
    return { isValid: false, reason: 'Can only declare marriage when leading a trick' };
  }

  if (declaredMarriages.includes(suit)) {
    return { isValid: false, reason: 'Marriage already declared' };
  }

  if (!hasMarriage(hand, suit)) {
    return { isValid: false, reason: 'No marriage in this suit' };
  }

  // Must lead with Queen of the marriage suit
  const hasQueen = hand.some(c => c.suit === suit && c.rank === 'Q');
  if (!hasQueen) {
    return { isValid: false, reason: 'Must have Queen to declare marriage' };
  }

  return { isValid: true };
}

export function validateCardPlay(
  card: Card,
  hand: Card[],
  trick: TrickState,
  trumpSuit: Suit | null,
  game: GameState
): ValidationResult {
  // Check card is in hand
  const hasCard = hand.some(c => c.suit === card.suit && c.rank === card.rank);
  if (!hasCard) {
    return { isValid: false, reason: 'Card not in hand' };
  }

  const validCards = getValidCards(hand, trick, trumpSuit, game);
  const isValid = validCards.some(c => c.suit === card.suit && c.rank === card.rank);

  if (!isValid) {
    return { isValid: false, reason: 'Invalid card for current rules' };
  }

  return { isValid: true };
}
