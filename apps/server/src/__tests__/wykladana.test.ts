import { describe, it, expect } from 'vitest';
import { detectWykladana } from '../game/wykladana.js';
import type { Card, Suit, Rank } from '@tysiac/shared';
import type { GameState, PlayerRoundState, RoundState } from '@tysiac/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand card constructor */
function card(rank: Rank, suit: Suit): Card {
  return { rank, suit };
}

/** Build a minimal PlayerRoundState with the given hand */
function playerRoundState(playerId: string, hand: Card[]): PlayerRoundState {
  return {
    playerId,
    hand,
    tricksWon: [],
    pointsFromTricks: 0,
    declaredMarriages: [],
    marriagePoints: 0,
  };
}

/**
 * Build a minimal GameState suitable for detectWykladana testing.
 *
 * By default, creates a game with one player ('player1') who is the bid winner,
 * and whose hand is the supplied array of cards.
 */
function makeGame(hand: Card[], overrides?: Partial<{
  bidWinner: string | null;
  playerId: string;
  currentRound: RoundState | null;
}>): GameState {
  const playerId = overrides?.playerId ?? 'player1';
  const bidWinner = overrides?.bidWinner === undefined ? playerId : overrides.bidWinner;

  const currentRound: RoundState | null = overrides?.currentRound !== undefined
    ? overrides.currentRound
    : {
        roundNumber: 1,
        dealer: 'player2',
        talon: [],
        talonRevealed: true,
        trumpSuit: null,
        bidWinner,
        finalBid: 100,
        players: {
          [playerId]: playerRoundState(playerId, hand),
          player2: playerRoundState('player2', []),
          player3: playerRoundState('player3', []),
        },
        currentTrick: null,
        completedTricks: 0,
        cardsToDistribute: [],
        isDealerSittingOut: false,
        dealerMarriagePoints: 0,
        talonMarriages: [],
      };

  return {
    id: 'test-game',
    roomId: 'test-room',
    phase: 'trickPlaying',
    players: [
      { id: playerId, name: 'Player 1', isAI: false, seatIndex: 0 },
      { id: 'player2', name: 'Player 2', isAI: false, seatIndex: 1 },
      { id: 'player3', name: 'Player 3', isAI: false, seatIndex: 2 },
    ],
    scores: {},
    currentRound,
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Rank order reference: A, 10, K, Q, J, 9 (highest to lowest)
// ---------------------------------------------------------------------------

describe('detectWykladana', () => {

  // =====================================================================
  // VALID wykladana hands
  // =====================================================================

  describe('valid wykladana hands', () => {

    it('should detect wykladana: A-10-K in one suit, Q-J-9 in another, A-10 in third (8 cards)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),   // hearts top 3
        card('A', 'spades'), card('10', 'spades'),                        // spades top 2
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'), // diamonds top 3
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: all 6 cards of one suit + A-10 of another (6+2=8)', () => {
      const hand: Card[] = [
        card('A', 'clubs'), card('10', 'clubs'), card('K', 'clubs'),
        card('Q', 'clubs'), card('J', 'clubs'), card('9', 'clubs'),       // all clubs
        card('A', 'hearts'), card('10', 'hearts'),                        // hearts top 2
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: 4 suits with 2 cards each (A-10 in each)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'),
        card('A', 'clubs'), card('10', 'clubs'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: single card per suit (all Aces)', () => {
      // 4 aces + A-10-K-Q in one suit = too many; let's do 8 cards across suits
      // Actually: a single card in a suit must be the Ace (top card).
      // 1 + 1 + 1 + 5 = 8
      const hand: Card[] = [
        card('A', 'hearts'),                                              // hearts: just Ace
        card('A', 'spades'),                                              // spades: just Ace
        card('A', 'diamonds'),                                            // diamonds: just Ace
        card('A', 'clubs'), card('10', 'clubs'), card('K', 'clubs'),
        card('Q', 'clubs'), card('J', 'clubs'),                           // clubs top 5
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: 2 suits with 4 cards each (A-10-K-Q)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'), card('Q', 'hearts'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'), card('Q', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: A-10-K-Q-J in one suit + A-10-K in another (5+3=8)', () => {
      const hand: Card[] = [
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('Q', 'spades'), card('J', 'spades'),                        // spades top 5
        card('A', 'clubs'), card('10', 'clubs'), card('K', 'clubs'),     // clubs top 3
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana with cards given in random order', () => {
      // Same as first valid case but shuffled - the function should sort internally
      const hand: Card[] = [
        card('K', 'hearts'), card('A', 'diamonds'), card('10', 'spades'),
        card('A', 'hearts'), card('K', 'diamonds'), card('10', 'diamonds'),
        card('10', 'hearts'), card('A', 'spades'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });
  });

  // =====================================================================
  // INVALID wykladana hands (gaps in sequence)
  // =====================================================================

  describe('invalid wykladana hands (gaps in sequences)', () => {

    it('should reject: A-K in a suit (gap, missing 10)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('K', 'hearts'),                          // gap: missing 10
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: 10-K-Q in a suit (missing A at top)', () => {
      const hand: Card[] = [
        card('10', 'hearts'), card('K', 'hearts'), card('Q', 'hearts'),   // missing A
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: A-10-Q in a suit (gap, missing K)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('Q', 'hearts'),   // gap: missing K
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: K-Q-J in a suit (missing A and 10 at top)', () => {
      const hand: Card[] = [
        card('K', 'clubs'), card('Q', 'clubs'), card('J', 'clubs'),       // starts at K, not A
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: A-10-K-J in a suit (gap, missing Q)', () => {
      const hand: Card[] = [
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
        card('J', 'diamonds'),                                             // gap: missing Q
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: single 9 in a suit (not starting from top)', () => {
      const hand: Card[] = [
        card('9', 'hearts'),                                               // just a 9, not Ace
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
        card('A', 'clubs'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: single Q in a suit (not starting from top)', () => {
      const hand: Card[] = [
        card('Q', 'hearts'),                                               // just a Q
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('Q', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: A-10-K-Q-J-9 in one suit + K in another (K not top)', () => {
      const hand: Card[] = [
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('Q', 'spades'), card('J', 'spades'), card('9', 'spades'),    // full suit
        card('K', 'hearts'),                                               // K alone (not A)
        card('A', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });
  });

  // =====================================================================
  // Edge case: wrong number of cards
  // =====================================================================

  describe('wrong number of cards in hand', () => {

    it('should reject: bidder has 7 cards (too few)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'),
      ];
      expect(hand).toHaveLength(7);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: bidder has 9 cards (too many)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(9);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: bidder has 10 cards (pre-distribution, talon added)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('Q', 'hearts'),
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(10);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: bidder has 0 cards (empty hand)', () => {
      const game = makeGame([]);
      expect(detectWykladana(game)).toBe(false);
    });
  });

  // =====================================================================
  // Missing game state fields
  // =====================================================================

  describe('missing or null game state fields', () => {

    it('should return false: no current round (null)', () => {
      const game = makeGame([], { currentRound: null });
      expect(detectWykladana(game)).toBe(false);
    });

    it('should return false: no bid winner (null)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];

      const game = makeGame(hand, { bidWinner: null });
      expect(detectWykladana(game)).toBe(false);
    });

    it('should return false: bid winner not found in players record', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];

      // Create game with player1 hand, but set bidWinner to a non-existent player
      const game = makeGame(hand);
      game.currentRound!.bidWinner = 'nonexistent-player';
      expect(detectWykladana(game)).toBe(false);
    });
  });

  // =====================================================================
  // Edge cases: mixed valid/invalid suit compositions
  // =====================================================================

  describe('edge cases', () => {

    it('should detect wykladana: 2 cards per suit across 4 suits (A-10 each)', () => {
      // Already tested above, but explicitly named for the edge case
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'),
        card('A', 'clubs'), card('10', 'clubs'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should reject: 3 suits with A-10 and 1 suit with K-Q (K is not top)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'spades'), card('10', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'),
        card('K', 'clubs'), card('Q', 'clubs'),                           // K-Q: not from top
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should detect wykladana: 8 cards all in one suit (A-10-K-Q-J-9 is only 6, so impossible)', () => {
      // A single suit has only 6 ranks, so 8 cards in one suit is impossible.
      // The maximum from one suit is 6, needing 2 more from another.
      // This test verifies the 6+2 case works.
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('Q', 'hearts'), card('J', 'hearts'), card('9', 'hearts'),    // all 6 hearts
        card('A', 'clubs'), card('10', 'clubs'),                          // clubs top 2
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should detect wykladana: 3 suits with 3+3+2 distribution (A-10-K, A-10-K, A-10)', () => {
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'), card('K', 'hearts'),
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(true);
    });

    it('should reject: one valid suit and one broken suit', () => {
      // hearts: A-10 (valid) + diamonds: A-K (gap, missing 10) + spades: A-10-K (valid)
      const hand: Card[] = [
        card('A', 'hearts'), card('10', 'hearts'),
        card('A', 'diamonds'), card('K', 'diamonds'),                      // gap!
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'clubs'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: J-9 in a suit (gap, both below K)', () => {
      const hand: Card[] = [
        card('J', 'hearts'), card('9', 'hearts'),                          // J-9 gap + not from top
        card('A', 'spades'), card('10', 'spades'), card('K', 'spades'),
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });

    it('should reject: A-10-K-Q-J-9 in one suit + 10-K in another (missing A)', () => {
      const hand: Card[] = [
        card('A', 'diamonds'), card('10', 'diamonds'), card('K', 'diamonds'),
        card('Q', 'diamonds'), card('J', 'diamonds'), card('9', 'diamonds'),
        card('10', 'clubs'), card('K', 'clubs'),                           // 10-K without A
      ];
      expect(hand).toHaveLength(8);

      const game = makeGame(hand);
      expect(detectWykladana(game)).toBe(false);
    });
  });
});
