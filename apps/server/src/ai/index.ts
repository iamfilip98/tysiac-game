import type { Card, Suit, TrickState } from '@tysiac/shared';
import {
  getTotalMarriageValue,
  countMarriagesInHand,
  hasMarriage,
  RANK_STRENGTH,
  CARD_POINTS,
  MARRIAGE_VALUES,
  SUITS
} from '@tysiac/shared';

/**
 * AI Player for Polish Tysiąc
 *
 * Strategy:
 * - Bidding: Conservative, based on hand strength and marriages
 * - Talon distribution: Give low cards, keep high cards and marriage pairs
 * - Playing: Try to win tricks when bidder, play strategically as defender
 */
export class AIPlayer {
  /**
   * Decide whether to bid and how much
   */
  decideBid(
    hand: Card[],
    currentBid: number,
    passedCount: number
  ): { shouldBid: boolean; amount?: number } {
    const handStrength = this.evaluateHandStrength(hand);
    const marriageValue = getTotalMarriageValue(hand);
    const maxBid = 120 + marriageValue;
    const minBid = currentBid === 100 ? 110 : currentBid + 10;

    // If can't bid higher, pass
    if (minBid > maxBid) {
      return { shouldBid: false };
    }

    // Calculate expected points
    const expectedPoints = this.calculateExpectedPoints(hand);

    // Be more aggressive if others have passed
    const aggression = passedCount > 0 ? 1.15 : 1.0;

    // Bid if expected points cover the bid
    const targetBid = Math.min(
      Math.floor((expectedPoints * aggression) / 10) * 10,
      maxBid
    );

    if (targetBid >= minBid) {
      // Bid only the minimum required (bids must increase by exactly 10)
      return { shouldBid: true, amount: minBid };
    }

    // With a strong hand, might bid anyway
    if (handStrength > 0.6 && minBid <= 130) {
      return { shouldBid: true, amount: minBid };
    }

    return { shouldBid: false };
  }

  /**
   * Decide which cards to give away after winning bid
   */
  decideDistribution(
    hand: Card[],
    otherPlayerIds: string[]
  ): { playerId: string; card: Card }[] {
    // Sort hand by value (lowest first)
    const sortedHand = [...hand].sort((a, b) => {
      // Keep marriage pairs together (don't give away Q or K if we have the pair)
      const aInMarriage = hasMarriage(hand, a.suit) && (a.rank === 'Q' || a.rank === 'K');
      const bInMarriage = hasMarriage(hand, b.suit) && (b.rank === 'Q' || b.rank === 'K');

      if (aInMarriage && !bInMarriage) return 1;
      if (!aInMarriage && bInMarriage) return -1;

      // Prefer giving away low cards
      const aValue = CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank];
      const bValue = CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank];

      return aValue - bValue;
    });

    // Give the two lowest value cards to opponents
    return [
      { playerId: otherPlayerIds[0], card: sortedHand[0] },
      { playerId: otherPlayerIds[1], card: sortedHand[1] },
    ];
  }

  /**
   * Decide whether to declare a marriage
   */
  decideMarriage(
    hand: Card[],
    alreadyDeclared: Suit[]
  ): Suit | null {
    const availableMarriages = SUITS.filter(
      suit => hasMarriage(hand, suit) && !alreadyDeclared.includes(suit)
    );

    if (availableMarriages.length === 0) return null;

    // Declare highest value marriage first
    availableMarriages.sort((a, b) => MARRIAGE_VALUES[b] - MARRIAGE_VALUES[a]);

    return availableMarriages[0];
  }

  /**
   * Decide which card to play
   */
  decideCard(
    validCards: Card[],
    trick: TrickState,
    trumpSuit: Suit | null,
    isBidder: boolean,
    bid: number
  ): Card {
    if (validCards.length === 1) {
      return validCards[0];
    }

    const isLeading = trick.cards.length === 0;

    if (isLeading) {
      return this.decideLeadCard(validCards, trumpSuit, isBidder);
    }

    return this.decideFollowCard(validCards, trick, trumpSuit, isBidder);
  }

  private decideLeadCard(
    validCards: Card[],
    trumpSuit: Suit | null,
    isBidder: boolean
  ): Card {
    if (isBidder) {
      // As bidder, lead with strong cards to win tricks
      // Prefer aces and 10s
      const aces = validCards.filter(c => c.rank === 'A');
      if (aces.length > 0) {
        // Lead ace of non-trump first
        const nonTrumpAces = aces.filter(c => c.suit !== trumpSuit);
        if (nonTrumpAces.length > 0) return nonTrumpAces[0];
        return aces[0];
      }

      // Lead 10s
      const tens = validCards.filter(c => c.rank === '10');
      if (tens.length > 0) {
        const nonTrumpTens = tens.filter(c => c.suit !== trumpSuit);
        if (nonTrumpTens.length > 0) return nonTrumpTens[0];
      }

      // Lead strong cards
      const sorted = [...validCards].sort((a, b) =>
        (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank]) -
        (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank])
      );
      return sorted[0];
    } else {
      // As defender, lead low to let partner take
      const sorted = [...validCards].sort((a, b) =>
        (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank]) -
        (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank])
      );
      return sorted[0];
    }
  }

  private decideFollowCard(
    validCards: Card[],
    trick: TrickState,
    trumpSuit: Suit | null,
    isBidder: boolean
  ): Card {
    const leadSuit = trick.leadSuit!;
    const playedCards = trick.cards.map(c => c.card);

    // Find the current winning card
    const winningCard = this.getCurrentWinner(playedCards, leadSuit, trumpSuit);

    // Cards that can beat current winner
    const beatingCards = validCards.filter(c =>
      this.canBeat(c, winningCard, leadSuit, trumpSuit)
    );

    if (isBidder) {
      // Bidder wants to win tricks
      if (beatingCards.length > 0) {
        // Play the lowest card that wins
        return this.lowestValue(beatingCards);
      }
      // Can't win, play lowest card
      return this.lowestValue(validCards);
    } else {
      // Defender strategy
      if (trick.cards.length === 1) {
        // Second to play - might want to let third (partner) win
        // Play middle value card
        const sorted = [...validCards].sort((a, b) =>
          (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank]) -
          (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank])
        );
        return sorted[Math.floor(sorted.length / 2)];
      } else {
        // Third to play
        if (beatingCards.length > 0) {
          // If can beat, play lowest winning card
          return this.lowestValue(beatingCards);
        }
        // Can't beat, dump lowest
        return this.lowestValue(validCards);
      }
    }
  }

  private evaluateHandStrength(hand: Card[]): number {
    let strength = 0;

    // Count aces (very strong)
    const aces = hand.filter(c => c.rank === 'A').length;
    strength += aces * 0.15;

    // Count 10s (strong)
    const tens = hand.filter(c => c.rank === '10').length;
    strength += tens * 0.1;

    // Count kings (good)
    const kings = hand.filter(c => c.rank === 'K').length;
    strength += kings * 0.05;

    // Marriages are very valuable
    const marriages = countMarriagesInHand(hand);
    strength += marriages.length * 0.2;

    // Long suits are good
    const suitCounts = SUITS.map(suit =>
      hand.filter(c => c.suit === suit).length
    );
    const maxSuitLength = Math.max(...suitCounts);
    if (maxSuitLength >= 4) strength += 0.1;

    return Math.min(1, strength);
  }

  private calculateExpectedPoints(hand: Card[]): number {
    let points = 0;

    // Marriage points
    points += getTotalMarriageValue(hand);

    // Estimate trick points based on high cards
    for (const card of hand) {
      if (card.rank === 'A') {
        points += 11; // Likely to win the ace
      } else if (card.rank === '10') {
        // 10 might win, might not
        points += 5;
      } else if (card.rank === 'K') {
        points += 2;
      }
    }

    // Add some points for talon possibilities
    points += 15; // Average expected from talon

    return points;
  }

  private getCurrentWinner(cards: Card[], leadSuit: Suit, trumpSuit: Suit | null): Card {
    let winner = cards[0];

    for (let i = 1; i < cards.length; i++) {
      if (this.canBeat(cards[i], winner, leadSuit, trumpSuit)) {
        winner = cards[i];
      }
    }

    return winner;
  }

  private canBeat(card: Card, toBeat: Card, leadSuit: Suit, trumpSuit: Suit | null): boolean {
    // Trump beats non-trump
    if (trumpSuit) {
      if (card.suit === trumpSuit && toBeat.suit !== trumpSuit) return true;
      if (card.suit !== trumpSuit && toBeat.suit === trumpSuit) return false;
      if (card.suit === trumpSuit && toBeat.suit === trumpSuit) {
        return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
      }
    }

    // Same suit comparison
    if (card.suit === toBeat.suit) {
      return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
    }

    // Different suits (non-trump) - only lead suit matters
    if (card.suit === leadSuit && toBeat.suit !== leadSuit) return true;

    return false;
  }

  private lowestValue(cards: Card[]): Card {
    return [...cards].sort((a, b) =>
      (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank]) -
      (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank])
    )[0];
  }
}
