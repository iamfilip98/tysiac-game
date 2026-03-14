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

    // With a strong hand, might bid anyway (but conservatively)
    const handStrength = this.evaluateHandStrength(hand);
    if (handStrength > 0.7 && minBid <= 120) {
      return { shouldBid: true, amount: minBid };
    }

    return { shouldBid: false };
  }

  // ─── Play or Pass Decision ───────────────────────────────────

  /**
   * Decide whether to play or pass after winning the bid and seeing the talon.
   * Evaluates the full 9-card hand (7 original + 3 talon, before distribution)
   * against the bid amount.
   */
  decidePlayOrPass(
    hand: Card[],
    finalBid: number,
    isOnBarrel: boolean
  ): 'play' | 'pass' {
    const expected = this.calculatePostTalonExpectedPoints(hand);

    if (finalBid <= 100) {
      // Passing at 100 is free (no penalty). Playing and failing costs -100.
      // Only play if we're reasonably confident we can make 100.
      return expected >= 80 ? 'play' : 'pass';
    }

    if (isOnBarrel) {
      // On barrel at >100: passing loses the bid amount anyway,
      // so playing at least gives a chance. Always play.
      return 'play';
    }

    // Use a sliding threshold: higher bids need more confidence
    // At 110-130: 80% confidence needed
    // At 140+: 85% confidence needed
    // At 180+: 90% confidence needed
    let threshold: number;
    if (finalBid <= 130) {
      threshold = 0.80;
    } else if (finalBid <= 170) {
      threshold = 0.85;
    } else {
      threshold = 0.90;
    }

    return expected >= finalBid * threshold ? 'play' : 'pass';
  }

  /**
   * More accurate point estimate for the 9-card post-talon hand.
   * We know all 9 cards so no talon guessing needed.
   */
  private calculatePostTalonExpectedPoints(hand: Card[]): number {
    let points = 0;

    // Marriage points (guaranteed if we lead the right trick)
    points += getTotalMarriageValue(hand);

    // Count trick-winning potential
    for (const card of hand) {
      if (card.rank === 'A') {
        // Aces are almost guaranteed trick winners
        points += 11;
      } else if (card.rank === '10') {
        const hasAce = hand.some(c => c.suit === card.suit && c.rank === 'A');
        // 10 with ace: very safe (both win tricks), ~19 points from the pair
        // 10 without ace: risky, ~40% chance of winning
        points += hasAce ? 10 : 4;
      } else if (card.rank === 'K') {
        // Kings occasionally win tricks (especially as trump or late game)
        points += 2;
      } else if (card.rank === 'Q') {
        // Queens rarely win but have some value
        points += 1;
      }
    }

    // Bonus for trump length (strong trump suit = more control)
    const marriages = countMarriagesInHand(hand);
    for (const { suit } of marriages) {
      const trumpCards = hand.filter(c => c.suit === suit);
      if (trumpCards.length >= 4) points += 10;
      else if (trumpCards.length >= 3) points += 5;
    }

    // Bonus for voids (can trump opponents' aces)
    const suitCounts = SUITS.map(suit => hand.filter(c => c.suit === suit).length);
    const voids = suitCounts.filter(c => c === 0).length;
    points += voids * 8;

    // Bonus for A-10 combos (guaranteed ~21 points from that suit)
    for (const suit of SUITS) {
      const hasAce = hand.some(c => c.suit === suit && c.rank === 'A');
      const hasTen = hand.some(c => c.suit === suit && c.rank === '10');
      if (hasAce && hasTen) points += 5;
    }

    return points;
  }

  // ─── Talon Distribution ───────────────────────────────────────

  decideDistribution(
    hand: Card[],
    otherPlayerIds: string[],
    scores?: Record<string, { totalScore: number }>
  ): { playerId: string; card: Card }[] {
    // Score each card for "give away" priority (higher = more likely to give)
    const scored = hand.map(card => ({
      card,
      score: this.distributionGiveScore(card, hand),
    }));

    // Sort by give-away score descending (best to give first)
    scored.sort((a, b) => b.score - a.score);

    const card1 = scored[0].card;
    const card2 = scored[1].card;

    // If we have score data, give the relatively better card to the weaker opponent
    if (scores && otherPlayerIds.length === 2) {
      const score0 = scores[otherPlayerIds[0]]?.totalScore ?? 0;
      const score1 = scores[otherPlayerIds[1]]?.totalScore ?? 0;
      const value1 = CARD_POINTS[card1.rank] + RANK_STRENGTH[card1.rank];
      const value2 = CARD_POINTS[card2.rank] + RANK_STRENGTH[card2.rank];

      // Better card (higher value) → weaker opponent (lower score)
      const [betterCard, worseCard] = value1 >= value2 ? [card1, card2] : [card2, card1];
      const [weakerPlayer, strongerPlayer] = score0 <= score1
        ? [otherPlayerIds[0], otherPlayerIds[1]]
        : [otherPlayerIds[1], otherPlayerIds[0]];

      return [
        { playerId: weakerPlayer, card: betterCard },
        { playerId: strongerPlayer, card: worseCard },
      ];
    }

    return [
      { playerId: otherPlayerIds[0], card: card1 },
      { playerId: otherPlayerIds[1], card: card2 },
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
      // Bidder: lead aces of non-trump first to collect guaranteed points
      const aces = validCards.filter(c => c.rank === 'A');
      if (aces.length > 0) {
        const nonTrumpAces = aces.filter(c => c.suit !== trumpSuit);
        if (nonTrumpAces.length > 0) {
          // Lead ace of suit where opponents likely have high cards to collect
          return this.pickSuitWithMostPoints(nonTrumpAces, remaining);
        }
        // Trump ace — lead if we have trump length to drain defenders
        return aces[0];
      }

      // Lead 10s where we know the ace is gone
      const tens = validCards.filter(c => c.rank === '10');
      for (const ten of tens) {
        const aceStillOut = remaining.some(r => r.suit === ten.suit && r.rank === 'A');
        if (!aceStillOut) return ten;
      }

      // Lead trump to pull defenders' trumps if we have strong trump position
      if (trumpSuit) {
        const myTrumps = validCards.filter(c => c.suit === trumpSuit);
        const outstandingTrumps = remaining.filter(c => c.suit === trumpSuit);
        if (myTrumps.length >= 2 && outstandingTrumps.length > 0) {
          // Lead highest trump to force out their strong trumps
          return this.highestValue(myTrumps);
        }
      }

      // No guaranteed winners left — lead low from longest non-trump suit to probe
      const nonTrump = validCards.filter(c => c.suit !== trumpSuit);
      if (nonTrump.length > 0) {
        const suitGroups = this.groupBySuit(nonTrump);
        let longestSuit: Card[] | null = null;
        let longestLen = 0;
        for (const cards of suitGroups.values()) {
          if (cards.length > longestLen) {
            longestLen = cards.length;
            longestSuit = cards;
          }
        }
        if (longestSuit) return this.lowestValue(longestSuit);
      }
      // Only trumps left — lead lowest
      return this.lowestValue(validCards);
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

      // Lead from non-trump suit where opponents still have cards
      // Score each suit: myCards × 2 + opponentCards (avoid leading into voids)
      const nonTrumpCards = validCards.filter(c => c.suit !== trumpSuit);
      if (nonTrumpCards.length > 0) {
        const suitGroups = this.groupBySuit(nonTrumpCards);
        let bestSuit: Card[] | null = null;
        let bestScore = -1;
        for (const [suit, cards] of suitGroups.entries()) {
          const opponentCards = remaining.filter(c => c.suit === suit).length;
          // Skip suits where opponents have no cards (they'll trump us)
          if (opponentCards === 0) continue;
          const score = cards.length * 2 + opponentCards;
          if (score > bestScore) {
            bestScore = score;
            bestSuit = cards;
          }
        }
        if (bestSuit) {
          // Lead lowest from chosen suit to probe safely
          return this.lowestValue(bestSuit);
        }
        // All non-trump suits are void for opponents — lead lowest non-trump
        return this.lowestValue(nonTrumpCards);
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

    const followingSuit = validCards.some(c => c.suit === leadSuit);

    const beatingCards = validCards.filter(c =>
      this.canBeat(c, winningCard, leadSuit, trumpSuit)
    );

    // ─── Off-suit: can't follow suit ─────────────────────
    if (!followingSuit) {
      return this.decideOffSuitCard(
        validCards, trick, trumpSuit, isBidder, bidderId,
        winningCard, winningPlayerId, remaining
      );
    }

    // ─── Following suit ──────────────────────────────────
    if (isBidder) {
      // Bidder wants to win tricks — beat with lowest winner
      if (beatingCards.length > 0) {
        return this.lowestValue(beatingCards);
      }
      return this.lowestValue(validCards);
    }

    // ─── Defender, following suit ─────────────────────────
    const isBidderWinning = winningPlayerId === bidderId;
    const isPartnerWinning = !isBidderWinning && winningPlayerId !== undefined;

    if (trick.cards.length === 1) {
      // ── Second to play, following suit ──
      if (playedPlayerIds[0] === bidderId) {
        // Bidder leads: beat with lowest winner, or dump lowest
        if (beatingCards.length > 0) {
          return this.lowestValue(beatingCards);
        }
        return this.lowestValue(validCards);
      } else {
        // Partner leads — bidder plays third and could still beat us
        const partnerCard = playedCards[0];
        const partnerIsStrong = RANK_STRENGTH[partnerCard.rank] >= 4; // 10 or A

        if (partnerIsStrong) {
          // Partner leads strong: feed points that don't overtake partner
          const feedCards = validCards.filter(c =>
            !this.canBeat(c, partnerCard, leadSuit, trumpSuit)
          );
          if (feedCards.length > 0) {
            return this.highestPoints(feedCards);
          }
          // All cards beat partner — play lowest to not steal
          return this.lowestValue(validCards);
        } else {
          // Partner leads weak: try to take over cheaply
          if (beatingCards.length > 0) {
            return this.lowestValue(beatingCards);
          }
          return this.lowestValue(validCards);
        }
      }
    } else {
      // ── Third to play, following suit ──
      if (isPartnerWinning) {
        // Partner is winning: feed points that don't overtake
        const feedCards = validCards.filter(c =>
          !this.canBeat(c, winningCard, leadSuit, trumpSuit)
        );
        if (feedCards.length > 0) {
          return this.highestPoints(feedCards);
        }
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

  /**
   * Handle off-suit play: we can't follow the lead suit.
   * Key principle: never waste high-value cards (Aces, protected 10s)
   * that would be better used as trick-winners when led later.
   */
  private decideOffSuitCard(
    validCards: Card[],
    trick: TrickState,
    trumpSuit: Suit | null,
    isBidder: boolean,
    bidderId: string,
    winningCard: Card,
    winningPlayerId: string,
    remaining: Card[]
  ): Card {
    const isBidderWinning = winningPlayerId === bidderId;
    const isPartnerWinning = !isBidderWinning && winningPlayerId !== undefined;

    const myTrumps = trumpSuit ? validCards.filter(c => c.suit === trumpSuit) : [];
    const trickPointValue = trick.cards.reduce((sum, c) => sum + CARD_POINTS[c.card.rank], 0);

    if (isBidder) {
      // Bidder off-suit: trump to win the trick if possible
      if (myTrumps.length > 0) {
        const beatingTrumps = myTrumps.filter(c =>
          this.canBeat(c, winningCard, trick.leadSuit!, trumpSuit)
        );
        if (beatingTrumps.length > 0) {
          return this.lowestValue(beatingTrumps);
        }
      }
      // Can't win — dump lowest expendable card
      return this.lowestExpendable(validCards, trumpSuit);
    }

    // ─── Defender off-suit ───────────────────────────────

    if (isPartnerWinning) {
      // Partner is winning: dump our least valuable card.
      // Never feed Aces or protected 10s off-suit — they're worth far
      // more as trick-winners when we lead them later.
      return this.lowestExpendable(validCards, trumpSuit);
    }

    // Bidder is winning (or will play after us)
    if (myTrumps.length > 0) {
      const beatingTrumps = myTrumps.filter(c =>
        this.canBeat(c, winningCard, trick.leadSuit!, trumpSuit)
      );

      if (beatingTrumps.length > 0) {
        // Trump to steal the trick from bidder — but only if worth it
        // Worth it if: trick has meaningful points, or we have plenty of trumps
        const isTrickValuable = trickPointValue >= 10;
        const haveTrumpDepth = myTrumps.length >= 2;

        if (isTrickValuable || haveTrumpDepth) {
          return this.lowestValue(beatingTrumps);
        }

        // Trick has few points and we'd spend our last trump — not worth it
        // unless the bidder is winning (deny them even small tricks late game)
        if (remaining.length <= 12) {
          // Late game: fight for every trick
          return this.lowestValue(beatingTrumps);
        }
      }
    }

    // Can't trump or not worth it — dump lowest expendable card
    return this.lowestExpendable(validCards, trumpSuit);
  }

  /**
   * Pick the lowest-value "expendable" card — one that won't be missed.
   * Preserves: Aces (guaranteed winners), 10s with their Ace still in hand,
   * and trumps (if we have few).
   */
  private lowestExpendable(cards: Card[], trumpSuit: Suit | null): Card {
    // Score each card by how expendable it is (lower = more expendable)
    const scored = cards.map(card => {
      let keepValue = CARD_POINTS[card.rank] + RANK_STRENGTH[card.rank];

      // Aces are guaranteed trick winners — very high keep value
      if (card.rank === 'A') keepValue += 30;

      // 10s with their Ace still in hand are safe winners — high keep value
      if (card.rank === '10') {
        const hasAce = cards.some(c => c.suit === card.suit && c.rank === 'A');
        if (hasAce) keepValue += 20;
        // Exposed 10 (no ace) is risky but still 10 points if it wins
        else keepValue += 5;
      }

      // Trumps are valuable for control — keep them
      if (trumpSuit && card.suit === trumpSuit) keepValue += 10;

      // Marriage pair cards are worth keeping
      if ((card.rank === 'Q' || card.rank === 'K') &&
          cards.some(c => c.suit === card.suit && c.rank === (card.rank === 'Q' ? 'K' : 'Q'))) {
        keepValue += 15;
      }

      return { card, keepValue };
    });

    // Sort by keepValue ascending — most expendable first
    scored.sort((a, b) => a.keepValue - b.keepValue);
    return scored[0].card;
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
