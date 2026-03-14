import type { Card, Suit, GameState, TrickState } from '@tysiac/shared';
import { RANK_STRENGTH, getTotalMarriageValue, hasMarriage } from '@tysiac/shared';

/**
 * Card play validation for Polish Tysiąc:
 * - All players must follow suit if they can
 * - Second player must beat the lead card if possible (when following suit)
 * - Third player has no obligation to beat — just follow suit
 * - If can't follow suit, any card is valid (no trump obligation)
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
  const cardsInSuit = hand.filter(c => c.suit === leadSuit);

  // Can't follow suit — any card is valid (no trump obligation)
  if (cardsInSuit.length === 0) {
    return [...hand];
  }

  // Third player: just follow suit, no obligation to beat
  if (trick.cards.length === 2) {
    return cardsInSuit;
  }

  // Second player: must beat the lead card if possible
  const leadCard = trick.cards[0].card;
  const beatingCards = cardsInSuit.filter(c =>
    canBeat(c, leadCard, leadSuit, trumpSuit)
  );

  return beatingCards.length > 0 ? beatingCards : cardsInSuit;
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

export interface TrickWinnerResult {
  winnerId: string;
  winningCard: Card;
  reason: string;
}

export function getTrickWinner(
  trick: TrickState,
  trumpSuit: Suit | null
): string {
  return getTrickWinnerWithReason(trick, trumpSuit).winnerId;
}

export function getTrickWinnerWithReason(
  trick: TrickState,
  trumpSuit: Suit | null
): TrickWinnerResult {
  const leadSuit = trick.leadSuit!;
  const cards = trick.cards.map(c => c.card);
  const highestCard = getHighestCardInTrick(cards, leadSuit, trumpSuit);

  const winner = trick.cards.find(c =>
    c.card.suit === highestCard.suit && c.card.rank === highestCard.rank
  );

  // Determine reason
  let reason: string;
  const isTrump = trumpSuit && highestCard.suit === trumpSuit;
  const isLeadSuit = highestCard.suit === leadSuit;

  if (isTrump && !isLeadSuit) {
    reason = `${highestCard.rank}${highestCard.suit} won by trumping (trump: ${trumpSuit}, lead: ${leadSuit})`;
  } else if (isTrump && isLeadSuit) {
    reason = `${highestCard.rank}${highestCard.suit} won as highest trump (trump is lead suit)`;
  } else {
    reason = `${highestCard.rank}${highestCard.suit} won as highest card in lead suit (${leadSuit})`;
  }

  return { winnerId: winner!.playerId, winningCard: highestCard, reason };
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
