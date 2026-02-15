import type { Card, Suit, TrickState, PlayerRoundState } from '@tysiac/shared';
import {
  getTotalMarriageValue,
  countMarriagesInHand,
  hasMarriage,
  RANK_STRENGTH,
  CARD_POINTS,
  MARRIAGE_VALUES,
  SUITS,
  RANKS
} from '@tysiac/shared';

/**
 * AI Player for Polish Tysiąc
 *
 * Strategy improvements:
 * - Card memory: tracks played cards to make informed decisions
 * - Defender cooperation: partners feed points, block bidder
 * - Smart leading: defenders lead aces/10s, drain trump
 * - Strategic distribution: create voids for trumping
 * - Better bidding: voids, A-10 combos, talon estimation
 */
export class AIPlayer {
  // ─── Card Memory ──────────────────────────────────────────────

  /**
   * Derive all cards played so far from tricksWon arrays + current trick
   */
  private getPlayedCards(
    roundPlayers: Record<string, PlayerRoundState>,
    currentTrick: TrickState
  ): Card[] {
    const played: Card[] = [];

    // Cards from completed tricks
    for (const player of Object.values(roundPlayers)) {
      for (const trick of player.tricksWon) {
        played.push(...trick);
      }
    }

    // Cards in current trick
    for (const { card } of currentTrick.cards) {
      played.push(card);
    }

    return played;
  }

  /**
   * Cards not in our hand and not yet played — still in opponents' hands
   */
  private getRemainingCards(hand: Card[], playedCards: Card[]): Card[] {
    const isPlayed = (c: Card) =>
      playedCards.some(p => p.suit === c.suit && p.rank === c.rank);
    const isInHand = (c: Card) =>
      hand.some(h => h.suit === c.suit && h.rank === c.rank);

    const remaining: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const card = { suit, rank };
        if (!isPlayed(card) && !isInHand(card)) {
          remaining.push(card);
        }
      }
    }
    return remaining;
  }

  // ─── Bidding ──────────────────────────────────────────────────

  decideBid(
    hand: Card[],
    currentBid: number,
    passedCount: number
  ): { shouldBid: boolean; amount?: number } {
    const marriageValue = getTotalMarriageValue(hand);
    const maxBid = 120 + marriageValue;
    const minBid = currentBid === 100 ? 110 : currentBid + 10;

    if (minBid > maxBid) {
      return { shouldBid: false };
    }

    const expectedPoints = this.calculateExpectedPoints(hand);

    // Be more aggressive if others have passed
    const aggression = passedCount > 0 ? 1.15 : 1.0;

    const targetBid = Math.min(
      Math.floor((expectedPoints * aggression) / 10) * 10,
      maxBid
    );

    if (targetBid >= minBid) {
      return { shouldBid: true, amount: minBid };
    }

    // With a strong hand, might bid anyway
    const handStrength = this.evaluateHandStrength(hand);
    if (handStrength > 0.6 && minBid <= 130) {
      return { shouldBid: true, amount: minBid };
    }

    return { shouldBid: false };
  }

  // ─── Talon Distribution ───────────────────────────────────────

  decideDistribution(
    hand: Card[],
    otherPlayerIds: string[]
  ): { playerId: string; card: Card }[] {
    // Score each card for "give away" priority (higher = more likely to give)
    const scored = hand.map(card => ({
      card,
      score: this.distributionGiveScore(card, hand),
    }));

    // Sort by give-away score descending (best to give first)
    scored.sort((a, b) => b.score - a.score);

    return [
      { playerId: otherPlayerIds[0], card: scored[0].card },
      { playerId: otherPlayerIds[1], card: scored[1].card },
    ];
  }

  /**
   * Score how much we want to give away a card (higher = give away more)
   */
  private distributionGiveScore(card: Card, hand: Card[]): number {
    let score = 0;

    // Never give away marriage pair cards
    if (hasMarriage(hand, card.suit) && (card.rank === 'Q' || card.rank === 'K')) {
      return -100;
    }

    // Prefer giving from short suits to create voids for trumping
    const suitCards = hand.filter(c => c.suit === card.suit);
    const suitLength = suitCards.length;

    if (suitLength === 1) {
      // Singleton: giving creates a void — very desirable
      // But only if it's not a high-value card we want to keep
      score += 20;
    } else if (suitLength === 2) {
      // Doubleton: giving creates a singleton, close to void
      score += 12;
    } else {
      // Long suit: prefer keeping intact
      score -= suitLength * 2;
    }

    // Prefer giving low-value cards
    const cardValue = CARD_POINTS[card.rank] + RANK_STRENGTH[card.rank];
    score -= cardValue * 2;

    // Don't give aces — they win tricks
    if (card.rank === 'A') score -= 15;

    // Don't give 10s if we have the ace (they're safe winners)
    if (card.rank === '10') {
      const hasAce = hand.some(c => c.suit === card.suit && c.rank === 'A');
      if (hasAce) score -= 10;
      else score += 2; // Exposed 10 without ace is risky, ok to give
    }

    // Avoid giving opponents potential marriage-completing cards
    // If we're giving a Q or K and opponent might have the pair
    if (card.rank === 'Q' || card.rank === 'K') {
      // We don't have the pair (checked above), so opponent might
      // Slightly penalize giving marriage cards
      score -= 3;
    }

    // 9s are basically worthless, good to give
    if (card.rank === '9') score += 8;

    return score;
  }

  // ─── Marriage Declaration ─────────────────────────────────────

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

  // ─── Card Play ────────────────────────────────────────────────

  decideCard(
    validCards: Card[],
    trick: TrickState,
    trumpSuit: Suit | null,
    isBidder: boolean,
    bid: number,
    bidderId: string,
    roundPlayers: Record<string, PlayerRoundState>,
    myId: string
  ): Card {
    if (validCards.length === 1) {
      return validCards[0];
    }

    const playedCards = this.getPlayedCards(roundPlayers, trick);
    const myHand = roundPlayers[myId]?.hand || validCards;
    const remaining = this.getRemainingCards(myHand, playedCards);
    const isLeading = trick.cards.length === 0;

    if (isLeading) {
      return this.decideLeadCard(validCards, trumpSuit, isBidder, remaining);
    }

    return this.decideFollowCard(validCards, trick, trumpSuit, isBidder, bidderId, remaining);
  }

  private decideLeadCard(
    validCards: Card[],
    trumpSuit: Suit | null,
    isBidder: boolean,
    remaining: Card[]
  ): Card {
    if (isBidder) {
      // Bidder: lead aces of non-trump first, then 10s with ace backup
      const aces = validCards.filter(c => c.rank === 'A');
      if (aces.length > 0) {
        const nonTrumpAces = aces.filter(c => c.suit !== trumpSuit);
        if (nonTrumpAces.length > 0) return nonTrumpAces[0];
        return aces[0];
      }

      // Lead 10s where we know the ace is gone
      const tens = validCards.filter(c => c.rank === '10');
      for (const ten of tens) {
        const aceStillOut = remaining.some(r => r.suit === ten.suit && r.rank === 'A');
        if (!aceStillOut && ten.suit !== trumpSuit) return ten;
      }

      // Lead strong non-trump cards
      const sorted = [...validCards].sort((a, b) =>
        (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank]) -
        (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank])
      );
      return sorted[0];
    } else {
      // Defender leading: aggressive — lead aces/10s to grab points

      // Lead aces of non-trump suits (guaranteed winners)
      const nonTrumpAces = validCards.filter(c => c.rank === 'A' && c.suit !== trumpSuit);
      if (nonTrumpAces.length > 0) {
        // Pick ace of suit with highest remaining point cards
        return this.pickSuitWithMostPoints(nonTrumpAces, remaining);
      }

      // Lead safe 10s (ace already played for that suit)
      const safeTens = validCards.filter(c => {
        if (c.rank !== '10' || c.suit === trumpSuit) return false;
        const aceStillOut = remaining.some(r => r.suit === c.suit && r.rank === 'A');
        return !aceStillOut;
      });
      if (safeTens.length > 0) return safeTens[0];

      // Lead trump to drain bidder's trumps if we have trump length
      if (trumpSuit) {
        const myTrumps = validCards.filter(c => c.suit === trumpSuit);
        const outstandingTrumps = remaining.filter(c => c.suit === trumpSuit);
        if (myTrumps.length >= 2 && outstandingTrumps.length > 0) {
          // Lead lowest trump to drain
          return this.lowestValue(myTrumps);
        }
      }

      // Lead from longest non-trump suit
      const nonTrumpCards = validCards.filter(c => c.suit !== trumpSuit);
      if (nonTrumpCards.length > 0) {
        // Group by suit, find longest
        const suitGroups = this.groupBySuit(nonTrumpCards);
        let bestSuit: Card[] | null = null;
        let bestLen = 0;
        for (const cards of suitGroups.values()) {
          if (cards.length > bestLen) {
            bestLen = cards.length;
            bestSuit = cards;
          }
        }
        if (bestSuit) {
          // Lead highest from longest suit
          return this.highestValue(bestSuit);
        }
      }

      // Last resort: lead lowest card (9s)
      return this.lowestValue(validCards);
    }
  }

  private decideFollowCard(
    validCards: Card[],
    trick: TrickState,
    trumpSuit: Suit | null,
    isBidder: boolean,
    bidderId: string,
    remaining: Card[]
  ): Card {
    const leadSuit = trick.leadSuit!;
    const playedCards = trick.cards.map(c => c.card);
    const playedPlayerIds = trick.cards.map(c => c.playerId);

    const winningCard = this.getCurrentWinner(playedCards, leadSuit, trumpSuit);
    const winningPlayerIdx = playedCards.indexOf(winningCard);
    const winningPlayerId = playedPlayerIds[winningPlayerIdx];

    const beatingCards = validCards.filter(c =>
      this.canBeat(c, winningCard, leadSuit, trumpSuit)
    );

    if (isBidder) {
      // Bidder wants to win tricks
      if (beatingCards.length > 0) {
        return this.lowestValue(beatingCards);
      }
      return this.lowestValue(validCards);
    }

    // ─── Defender strategy ──────────────────────────────
    const isBidderLeading = playedPlayerIds[0] === bidderId;
    const isBidderWinning = winningPlayerId === bidderId;
    const isPartnerWinning = !isBidderWinning && winningPlayerId !== undefined;

    if (trick.cards.length === 1) {
      // ── Second to play ──
      if (isBidderLeading) {
        // Bidder leads: try to beat with lowest winning card
        if (beatingCards.length > 0) {
          return this.lowestValue(beatingCards);
        }
        // Can't beat, dump lowest value card
        return this.lowestValue(validCards);
      } else {
        // Partner leads
        const partnerCard = playedCards[0];
        const partnerIsStrong = RANK_STRENGTH[partnerCard.rank] >= 4; // 10 or A

        if (partnerIsStrong) {
          // Partner leads strong: feed high-point cards partner can win
          // Play our highest point card that doesn't overtake partner
          const feedCards = validCards.filter(c =>
            !this.canBeat(c, partnerCard, leadSuit, trumpSuit)
          );
          if (feedCards.length > 0) {
            return this.highestPoints(feedCards);
          }
          // All our cards beat partner — play lowest
          return this.lowestValue(validCards);
        } else {
          // Partner leads weak: try to beat cheaply, as bidder plays third
          if (beatingCards.length > 0) {
            return this.lowestValue(beatingCards);
          }
          return this.lowestValue(validCards);
        }
      }
    } else {
      // ── Third to play ──
      if (isPartnerWinning) {
        // Partner is winning: feed high-point card that doesn't overtake partner
        const feedCards = validCards.filter(c =>
          !this.canBeat(c, winningCard, leadSuit, trumpSuit)
        );
        if (feedCards.length > 0) {
          return this.highestPoints(feedCards);
        }
        // All our cards beat partner — play lowest to not steal the trick
        return this.lowestValue(validCards);
      } else {
        // Bidder is winning: beat with lowest winner, or dump lowest
        if (beatingCards.length > 0) {
          return this.lowestValue(beatingCards);
        }
        return this.lowestValue(validCards);
      }
    }
  }

  // ─── Hand Evaluation ──────────────────────────────────────────

  private evaluateHandStrength(hand: Card[]): number {
    let strength = 0;

    // Aces
    const aces = hand.filter(c => c.rank === 'A').length;
    strength += aces * 0.15;

    // 10s
    const tens = hand.filter(c => c.rank === '10').length;
    strength += tens * 0.1;

    // A-10 combos in same suit (very strong)
    for (const suit of SUITS) {
      const hasAce = hand.some(c => c.suit === suit && c.rank === 'A');
      const hasTen = hand.some(c => c.suit === suit && c.rank === '10');
      if (hasAce && hasTen) strength += 0.1; // Bonus for the combo
    }

    // Kings
    const kings = hand.filter(c => c.rank === 'K').length;
    strength += kings * 0.05;

    // Marriages
    const marriages = countMarriagesInHand(hand);
    strength += marriages.length * 0.2;

    // Long suits
    const suitCounts = SUITS.map(suit =>
      hand.filter(c => c.suit === suit).length
    );
    const maxSuitLength = Math.max(...suitCounts);
    if (maxSuitLength >= 4) strength += 0.1;

    // Voids (suits with no cards) — great for trumping
    const voids = suitCounts.filter(c => c === 0).length;
    strength += voids * 0.08;

    return Math.min(1, strength);
  }

  private calculateExpectedPoints(hand: Card[]): number {
    let points = 0;

    // Marriage points
    points += getTotalMarriageValue(hand);

    // Estimate trick points based on high cards
    for (const card of hand) {
      if (card.rank === 'A') {
        points += 11;
      } else if (card.rank === '10') {
        // 10 with same-suit ace is much safer
        const hasAce = hand.some(c => c.suit === card.suit && c.rank === 'A');
        points += hasAce ? 9 : 4;
      } else if (card.rank === 'K') {
        points += 2;
      }
    }

    // Smarter talon estimation based on hand needs
    const marriages = countMarriagesInHand(hand);
    const nearMarriages = SUITS.filter(suit => {
      if (hasMarriage(hand, suit)) return false;
      const hasQ = hand.some(c => c.suit === suit && c.rank === 'Q');
      const hasK = hand.some(c => c.suit === suit && c.rank === 'K');
      return hasQ || hasK;
    });

    // Each near-marriage has ~1/6 chance of completing from talon (2 cards from ~17 remaining)
    // Weighted by marriage value
    let talonEstimate = 10; // Base talon value
    for (const suit of nearMarriages) {
      talonEstimate += MARRIAGE_VALUES[suit] * 0.12; // ~12% chance
    }
    points += talonEstimate;

    return points;
  }

  // ─── Helpers ──────────────────────────────────────────────────

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
    if (trumpSuit) {
      if (card.suit === trumpSuit && toBeat.suit !== trumpSuit) return true;
      if (card.suit !== trumpSuit && toBeat.suit === trumpSuit) return false;
      if (card.suit === trumpSuit && toBeat.suit === trumpSuit) {
        return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
      }
    }

    if (card.suit === toBeat.suit) {
      return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
    }

    if (card.suit === leadSuit && toBeat.suit !== leadSuit) return true;

    return false;
  }

  private lowestValue(cards: Card[]): Card {
    return [...cards].sort((a, b) =>
      (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank]) -
      (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank])
    )[0];
  }

  private highestValue(cards: Card[]): Card {
    return [...cards].sort((a, b) =>
      (CARD_POINTS[b.rank] + RANK_STRENGTH[b.rank]) -
      (CARD_POINTS[a.rank] + RANK_STRENGTH[a.rank])
    )[0];
  }

  private highestPoints(cards: Card[]): Card {
    return [...cards].sort((a, b) =>
      CARD_POINTS[b.rank] - CARD_POINTS[a.rank]
    )[0];
  }

  private pickSuitWithMostPoints(aces: Card[], remaining: Card[]): Card {
    if (aces.length === 1) return aces[0];

    // Pick the ace whose suit has the most remaining point cards
    let best = aces[0];
    let bestPoints = 0;
    for (const ace of aces) {
      const suitPoints = remaining
        .filter(c => c.suit === ace.suit)
        .reduce((sum, c) => sum + CARD_POINTS[c.rank], 0);
      if (suitPoints > bestPoints) {
        bestPoints = suitPoints;
        best = ace;
      }
    }
    return best;
  }

  private groupBySuit(cards: Card[]): Map<Suit, Card[]> {
    const groups = new Map<Suit, Card[]>();
    for (const card of cards) {
      const existing = groups.get(card.suit) || [];
      existing.push(card);
      groups.set(card.suit, existing);
    }
    return groups;
  }
}
