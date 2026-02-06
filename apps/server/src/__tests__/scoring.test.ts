import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, PlayerScore, GamePhase, Suit, Card } from '@tysiac/shared';

// Mock the debug service so scoring.ts doesn't try to hit the database
vi.mock('../services/debugService.js', () => ({
  logDebug: vi.fn(),
}));

import { calculateRoundScores, applyScores } from '../game/scoring.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal mock GameState with sensible defaults
// ---------------------------------------------------------------------------

interface MockGameOverrides {
  players?: { id: string; name: string; isAI: boolean; seatIndex: number }[];
  scores?: Record<string, Partial<PlayerScore>>;
  currentRound?: Partial<NonNullable<GameState['currentRound']>>;
  roundPlayers?: Record<string, Partial<{
    playerId: string;
    hand: Card[];
    tricksWon: Card[][];
    pointsFromTricks: number;
    declaredMarriages: Suit[];
    marriagePoints: number;
  }>>;
  phase?: GamePhase;
  winner?: string | null;
}

function createMockGame(overrides: MockGameOverrides = {}): GameState {
  const defaultPlayers = [
    { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
    { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
    { id: 'p3', name: 'Charlie', isAI: false, seatIndex: 2 },
  ];

  const players = overrides.players ?? defaultPlayers;

  // Build scores with defaults for each player
  const scores: Record<string, PlayerScore> = {};
  for (const p of players) {
    const partial = overrides.scores?.[p.id] ?? {};
    scores[p.id] = {
      playerId: p.id,
      totalScore: partial.totalScore ?? 0,
      roundScores: partial.roundScores ?? [],
      isOnBarrel: partial.isOnBarrel ?? false,
      barrelAttempts: partial.barrelAttempts ?? 0,
    };
  }

  // Build round player states
  const roundPlayers: Record<string, {
    playerId: string;
    hand: Card[];
    tricksWon: Card[][];
    pointsFromTricks: number;
    declaredMarriages: Suit[];
    marriagePoints: number;
  }> = {};
  for (const p of players) {
    const partial = overrides.roundPlayers?.[p.id] ?? {};
    roundPlayers[p.id] = {
      playerId: p.id,
      hand: partial.hand ?? [],
      tricksWon: partial.tricksWon ?? [],
      pointsFromTricks: partial.pointsFromTricks ?? 0,
      declaredMarriages: partial.declaredMarriages ?? [],
      marriagePoints: partial.marriagePoints ?? 0,
    };
  }

  const currentRound = {
    roundNumber: 1,
    dealer: 'p1',
    talon: [],
    talonRevealed: true,
    trumpSuit: null as Suit | null,
    bidWinner: 'p1',
    finalBid: 100,
    players: roundPlayers,
    currentTrick: null,
    completedTricks: 8,
    cardsToDistribute: [],
    isDealerSittingOut: false,
    dealerMarriagePoints: 0,
    talonMarriages: [] as Suit[],
    ...overrides.currentRound,
    // Ensure round players override is merged properly if currentRound also
    // has its own players override (currentRound.players takes priority)
  } as NonNullable<GameState['currentRound']>;

  // If the caller provided roundPlayers AND currentRound.players, the
  // spread above already handles it; but if only roundPlayers was given,
  // we need to make sure they're used.
  if (!overrides.currentRound?.players) {
    currentRound.players = roundPlayers;
  }

  return {
    id: 'game-1',
    roomId: 'room-1',
    phase: overrides.phase ?? 'roundScoring',
    players,
    scores,
    currentRound,
    winner: overrides.winner ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as GameState;
}

// ---------------------------------------------------------------------------
// Helper to make a set of trick cards (just needs to be non-empty array)
// ---------------------------------------------------------------------------
function makeTrick(): Card[] {
  return [
    { suit: 'hearts', rank: 'A' },
    { suit: 'hearts', rank: 'K' },
    { suit: 'hearts', rank: 'Q' },
  ];
}

// ===========================================================================
// Tests
// ===========================================================================

describe('scoring module', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Bidder makes bid -> scores roundToTen(totalRoundPoints)
  // -----------------------------------------------------------------------
  describe('bidder makes bid', () => {
    it('scores roundToTen of total points when totalRoundPoints >= bid', () => {
      // Bidder p1 bid 100, earned 55 trick points + 60 marriage = 115 total
      // roundToTen(115) = 120 (5 rounds down, but 115 % 10 = 5, < 6 so round down => 110)
      // Wait: 115 % 10 = 5, which is < 6, so roundToTen(115) = 110
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 55, marriagePoints: 60, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 35, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.totalRoundPoints).toBe(115); // 55 + 60
      expect(bidderScore.scoreChange).toBe(110); // roundToTen(115) = 110
      expect(bidderScore.newTotalScore).toBe(110);
    });

    it('scores exact bid value when total equals bid exactly', () => {
      // Bidder p1 bid 100, earned exactly 100 trick points
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.totalRoundPoints).toBe(100);
      expect(bidderScore.scoreChange).toBe(100); // roundToTen(100) = 100
      expect(bidderScore.newTotalScore).toBe(100);
    });

    it('rounds up bidder score when remainder >= 6', () => {
      // Bidder earned 126 total (126 % 10 = 6, >= 6, rounds up to 130)
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 66, marriagePoints: 60, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 24, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.totalRoundPoints).toBe(126);
      expect(bidderScore.scoreChange).toBe(130); // roundToTen(126) = 130
    });
  });

  // -----------------------------------------------------------------------
  // 2. Bidder fails bid -> loses bid amount
  // -----------------------------------------------------------------------
  describe('bidder fails bid', () => {
    it('loses the bid amount when totalRoundPoints < bid', () => {
      // Bidder p1 bid 120, earned only 90 trick points (no marriages)
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 120,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 90, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 15, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 15, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(false);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.totalRoundPoints).toBe(90);
      expect(bidderScore.scoreChange).toBe(-120); // loses the bid
      expect(bidderScore.newTotalScore).toBe(-120); // started at 0
    });

    it('goes negative when starting from 0', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p2',
          finalBid: 150,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 50, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(false);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(bidderScore.scoreChange).toBe(-150);
      expect(bidderScore.newTotalScore).toBe(-150);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Non-bidder rounding to nearest 10
  // -----------------------------------------------------------------------
  describe('non-bidder rounding', () => {
    it('rounds down when remainder < 6 (e.g. 14 -> 10)', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 14, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 6, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(10); // roundToTen(14) = 10

      const p3Score = result.playerScores.find(s => s.playerId === 'p3')!;
      expect(p3Score.scoreChange).toBe(10); // roundToTen(6) = 10
    });

    it('rounds up when remainder >= 6 (e.g. 15 -> 20, 16 -> 20)', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 16, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 26, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(20); // roundToTen(16) = 20

      const p3Score = result.playerScores.find(s => s.playerId === 'p3')!;
      expect(p3Score.scoreChange).toBe(30); // roundToTen(26) = 30
    });

    it('rounds down when remainder is exactly 5', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 15, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 5, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(10); // roundToTen(15) = 10 (5 < 6)

      const p3Score = result.playerScores.find(s => s.playerId === 'p3')!;
      expect(p3Score.scoreChange).toBe(0); // roundToTen(5) = 0 (5 < 6)
    });

    it('gives 0 for 0 trick points and 0 marriage points', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 0, tricksWon: [] },
          p3: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 4. Marriage points (with and without tricks won)
  // -----------------------------------------------------------------------
  describe('marriage points', () => {
    it('includes marriage points for non-bidder who won at least one trick', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 80, marriagePoints: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 20, marriagePoints: 60, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      // totalRoundPoints = 20 + 60 = 80, roundToTen(80) = 80
      expect(p2Score.totalRoundPoints).toBe(80);
      expect(p2Score.scoreChange).toBe(80);
    });

    it('ignores marriage points for non-bidder who won zero tricks', () => {
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, marriagePoints: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 0, marriagePoints: 60, tricksWon: [] }, // No tricks!
          p3: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      // Marriage points not counted because no tricks won
      expect(p2Score.marriagePoints).toBe(0);
      expect(p2Score.totalRoundPoints).toBe(0);
      expect(p2Score.scoreChange).toBe(0);
    });

    it('includes marriage points for bidder who won at least one trick', () => {
      // Bidder p1 bid 160, earned 60 tricks + 100 marriage = 160
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 160,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 60, marriagePoints: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.totalRoundPoints).toBe(160);
      expect(bidderScore.scoreChange).toBe(160); // roundToTen(160) = 160
    });

    it('ignores marriage points for bidder who won zero tricks', () => {
      // Edge case: bidder won 0 tricks but declared marriages
      const game = createMockGame({
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 0, marriagePoints: 100, tricksWon: [] },
          p2: { pointsFromTricks: 60, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 60, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(false);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.marriagePoints).toBe(0);
      expect(bidderScore.totalRoundPoints).toBe(0);
      expect(bidderScore.scoreChange).toBe(-100); // Loses bid
    });
  });

  // -----------------------------------------------------------------------
  // 5. Barrel entry (score reaches 800+)
  // -----------------------------------------------------------------------
  describe('barrel entry', () => {
    it('marks player as on barrel when score reaches 800', () => {
      // p2 starts at 770, earns 36 trick points -> roundToTen(36) = 40 -> 810
      const game = createMockGame({
        scores: {
          p2: { totalScore: 770 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 36, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 0, tricksWon: [] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(40); // roundToTen(36) = 40
      expect(p2Score.newTotalScore).toBe(810);

      // After calculation, barrel status should be updated on the game scores
      expect(game.scores['p2'].isOnBarrel).toBe(true);
    });

    it('marks barrel entry at exactly 800', () => {
      // p3 starts at 780, earns 20 -> 800
      const game = createMockGame({
        scores: {
          p3: { totalScore: 780 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p3Score = result.playerScores.find(s => s.playerId === 'p3')!;
      expect(p3Score.newTotalScore).toBe(800);
      expect(game.scores['p3'].isOnBarrel).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 6. On barrel: bidder makes bid reaching 1000 -> wins
  // -----------------------------------------------------------------------
  describe('barrel: bidder reaches 1000', () => {
    it('wins the game when bidder on barrel reaches 1000', () => {
      // p1 on barrel at 880, bids 120, earns 120 -> new total 880 + 120 = 1000
      const game = createMockGame({
        scores: {
          p1: { totalScore: 880, isOnBarrel: true, barrelAttempts: 1 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 120,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 60, marriagePoints: 60, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);
      expect(result.winner).toBe('p1');

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.newTotalScore).toBe(1000);
      expect(bidderScore.fellOffBarrel).toBe(false);

      // Barrel attempts reset on win
      expect(game.scores['p1'].barrelAttempts).toBe(0);
    });

    it('wins when exceeding 1000', () => {
      // p1 on barrel at 900, bids 100, earns 106 -> roundToTen(106) = 110 -> 1010
      const game = createMockGame({
        scores: {
          p1: { totalScore: 900, isOnBarrel: true, barrelAttempts: 0 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 106, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 7, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 7, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.winner).toBe('p1');

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.newTotalScore).toBe(1010);
    });
  });

  // -----------------------------------------------------------------------
  // 7. On barrel: bidder makes bid but doesn't reach 1000 -> attempt incremented
  // -----------------------------------------------------------------------
  describe('barrel: bidder makes bid but does not reach 1000', () => {
    it('increments barrel attempt count', () => {
      // p1 on barrel at 820, bids 100, earns 100 -> 820 + 100 = 920 (< 1000)
      const game = createMockGame({
        scores: {
          p1: { totalScore: 820, isOnBarrel: true, barrelAttempts: 0 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(false);
      expect(bidderScore.newTotalScore).toBe(920);
      expect(game.scores['p1'].barrelAttempts).toBe(1);
    });

    it('increments from 1 to 2 on second attempt', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: 850, isOnBarrel: true, barrelAttempts: 1 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(false);
      expect(bidderScore.newTotalScore).toBe(950);
      expect(game.scores['p1'].barrelAttempts).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // 8. On barrel: 3 failed attempts -> fall back to 800
  // -----------------------------------------------------------------------
  describe('barrel: 3 failed attempts resets to 800', () => {
    it('falls off barrel on the 3rd attempt (made bid but < 1000)', () => {
      // p1 on barrel at 850, barrelAttempts=2, bids 100, earns 100 -> 950 (< 1000)
      // This is the 3rd attempt, so fall back to 800
      const game = createMockGame({
        scores: {
          p1: { totalScore: 850, isOnBarrel: true, barrelAttempts: 2 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(true);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(true);
      expect(bidderScore.newTotalScore).toBe(800); // Reset to BARREL_THRESHOLD
      expect(bidderScore.scoreChange).toBe(-50); // 800 - 850 = -50
      expect(game.scores['p1'].barrelAttempts).toBe(0); // Reset
    });

    it('does NOT fall off if bid reaches 1000 on 3rd attempt', () => {
      // p1 on barrel at 900, barrelAttempts=2, bids 100, earns 100 -> 1000 exactly
      // Reaching 1000 is a win, not a failed attempt
      const game = createMockGame({
        scores: {
          p1: { totalScore: 900, isOnBarrel: true, barrelAttempts: 2 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.winner).toBe('p1');

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.fellOffBarrel).toBe(false);
      expect(bidderScore.newTotalScore).toBe(1000);
      expect(game.scores['p1'].barrelAttempts).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 9. Non-bidder on barrel gets 0
  // -----------------------------------------------------------------------
  describe('non-bidder on barrel', () => {
    it('gets 0 score change regardless of tricks won', () => {
      // p2 is on barrel at 850, p1 is bidder
      const game = createMockGame({
        scores: {
          p2: { totalScore: 850, isOnBarrel: true },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 70, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 30, marriagePoints: 40, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.wasOnBarrel).toBe(true);
      expect(p2Score.scoreChange).toBe(0);
      expect(p2Score.newTotalScore).toBe(850); // Unchanged
    });

    it('stays on barrel (isOnBarrel remains true)', () => {
      const game = createMockGame({
        scores: {
          p2: { totalScore: 800, isOnBarrel: true },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 20, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 0, tricksWon: [] },
        },
      });

      calculateRoundScores(game);

      // After calculation, isOnBarrel should still be true
      expect(game.scores['p2'].isOnBarrel).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 10. Negative scores work
  // -----------------------------------------------------------------------
  describe('negative scores', () => {
    it('allows bidder to go negative from 0', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: 0 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 200,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 50, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 35, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 35, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.scoreChange).toBe(-200);
      expect(bidderScore.newTotalScore).toBe(-200);
    });

    it('allows score to go deeper negative', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: -100 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 150,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.scoreChange).toBe(-150);
      expect(bidderScore.newTotalScore).toBe(-250);
    });

    it('can recover from negative scores', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: -50 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.scoreChange).toBe(100);
      expect(bidderScore.newTotalScore).toBe(50); // -50 + 100
    });
  });

  // -----------------------------------------------------------------------
  // 11. 4-player: sitting-out dealer gets talon marriage points
  // -----------------------------------------------------------------------
  describe('4-player: sitting-out dealer', () => {
    it('gives sitting-out dealer talon marriage points (rounded to 10)', () => {
      const fourPlayers = [
        { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
        { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
        { id: 'p3', name: 'Charlie', isAI: false, seatIndex: 2 },
        { id: 'p4', name: 'Diana', isAI: false, seatIndex: 3 },
      ];

      const game = createMockGame({
        players: fourPlayers,
        currentRound: {
          dealer: 'p4',
          bidWinner: 'p1',
          finalBid: 100,
          isDealerSittingOut: true,
          dealerMarriagePoints: 80, // diamonds marriage from talon
          talonMarriages: ['diamonds'] as Suit[],
        },
        roundPlayers: {
          p1: { pointsFromTricks: 60, marriagePoints: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 30, tricksWon: [makeTrick()] },
          p4: { pointsFromTricks: 0, tricksWon: [] }, // Sitting out, no tricks
        },
      });

      const result = calculateRoundScores(game);

      const dealerScore = result.playerScores.find(s => s.playerId === 'p4')!;
      expect(dealerScore.sittingOut).toBe(true);
      expect(dealerScore.isDealer).toBe(true);
      expect(dealerScore.marriagePoints).toBe(80);
      expect(dealerScore.trickPoints).toBe(0); // No tricks for sitting-out dealer
      expect(dealerScore.scoreChange).toBe(80); // roundToTen(80) = 80
    });

    it('rounds talon marriage points to nearest 10', () => {
      const fourPlayers = [
        { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
        { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
        { id: 'p3', name: 'Charlie', isAI: false, seatIndex: 2 },
        { id: 'p4', name: 'Diana', isAI: false, seatIndex: 3 },
      ];

      const game = createMockGame({
        players: fourPlayers,
        currentRound: {
          dealer: 'p4',
          bidWinner: 'p1',
          finalBid: 100,
          isDealerSittingOut: true,
          dealerMarriagePoints: 46, // hypothetical odd value
          talonMarriages: ['spades'] as Suit[],
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p4: { pointsFromTricks: 0, tricksWon: [] },
        },
      });

      const result = calculateRoundScores(game);

      const dealerScore = result.playerScores.find(s => s.playerId === 'p4')!;
      // roundToTen(46) = 50 (6 >= 6, rounds up)
      expect(dealerScore.scoreChange).toBe(50);
    });

    it('gives 0 when dealer has no talon marriage points', () => {
      const fourPlayers = [
        { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
        { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
        { id: 'p3', name: 'Charlie', isAI: false, seatIndex: 2 },
        { id: 'p4', name: 'Diana', isAI: false, seatIndex: 3 },
      ];

      const game = createMockGame({
        players: fourPlayers,
        currentRound: {
          dealer: 'p4',
          bidWinner: 'p1',
          finalBid: 100,
          isDealerSittingOut: true,
          dealerMarriagePoints: 0,
          talonMarriages: [],
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p4: { pointsFromTricks: 0, tricksWon: [] },
        },
      });

      const result = calculateRoundScores(game);

      const dealerScore = result.playerScores.find(s => s.playerId === 'p4')!;
      expect(dealerScore.scoreChange).toBe(0);
      expect(dealerScore.sittingOut).toBe(true);
    });

    it('sitting-out dealer on barrel gets 0', () => {
      const fourPlayers = [
        { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
        { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
        { id: 'p3', name: 'Charlie', isAI: false, seatIndex: 2 },
        { id: 'p4', name: 'Diana', isAI: false, seatIndex: 3 },
      ];

      const game = createMockGame({
        players: fourPlayers,
        scores: {
          p4: { totalScore: 850, isOnBarrel: true },
        },
        currentRound: {
          dealer: 'p4',
          bidWinner: 'p1',
          finalBid: 100,
          isDealerSittingOut: true,
          dealerMarriagePoints: 80,
          talonMarriages: ['diamonds'] as Suit[],
        },
        roundPlayers: {
          p1: { pointsFromTricks: 100, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 10, tricksWon: [makeTrick()] },
          p4: { pointsFromTricks: 0, tricksWon: [] },
        },
      });

      const result = calculateRoundScores(game);

      const dealerScore = result.playerScores.find(s => s.playerId === 'p4')!;
      // On barrel + non-bidder = 0 (barrel check takes priority)
      expect(dealerScore.scoreChange).toBe(0);
      expect(dealerScore.newTotalScore).toBe(850);
    });
  });

  // -----------------------------------------------------------------------
  // applyScores
  // -----------------------------------------------------------------------
  describe('applyScores', () => {
    it('updates totalScore and roundScores for all players', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: 200, roundScores: [100, 100] },
          p2: { totalScore: 150, roundScores: [80, 70] },
          p3: { totalScore: 100, roundScores: [50, 50] },
        },
      });

      const scoreResult: ReturnType<typeof calculateRoundScores> = {
        bidderMadeBid: true,
        playerScores: [
          {
            playerId: 'p1',
            trickPoints: 80,
            marriagePoints: 40,
            totalRoundPoints: 120,
            scoreChange: 120,
            newTotalScore: 320,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
          {
            playerId: 'p2',
            trickPoints: 20,
            marriagePoints: 0,
            totalRoundPoints: 20,
            scoreChange: 20,
            newTotalScore: 170,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
          {
            playerId: 'p3',
            trickPoints: 20,
            marriagePoints: 0,
            totalRoundPoints: 20,
            scoreChange: 20,
            newTotalScore: 120,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
        ],
        winner: null,
      };

      applyScores(game, scoreResult);

      expect(game.scores['p1'].totalScore).toBe(320);
      expect(game.scores['p1'].roundScores).toEqual([100, 100, 120]);

      expect(game.scores['p2'].totalScore).toBe(170);
      expect(game.scores['p2'].roundScores).toEqual([80, 70, 20]);

      expect(game.scores['p3'].totalScore).toBe(120);
      expect(game.scores['p3'].roundScores).toEqual([50, 50, 20]);
    });

    it('sets game winner when scoreResult has a winner', () => {
      const game = createMockGame();

      const scoreResult: ReturnType<typeof calculateRoundScores> = {
        bidderMadeBid: true,
        playerScores: [
          {
            playerId: 'p1',
            trickPoints: 100,
            marriagePoints: 0,
            totalRoundPoints: 100,
            scoreChange: 100,
            newTotalScore: 1000,
            wasOnBarrel: true,
            fellOffBarrel: false,
          },
          {
            playerId: 'p2',
            trickPoints: 10,
            marriagePoints: 0,
            totalRoundPoints: 10,
            scoreChange: 10,
            newTotalScore: 10,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
          {
            playerId: 'p3',
            trickPoints: 10,
            marriagePoints: 0,
            totalRoundPoints: 10,
            scoreChange: 10,
            newTotalScore: 10,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
        ],
        winner: 'p1',
      };

      applyScores(game, scoreResult);

      expect(game.winner).toBe('p1');
    });

    it('does not set winner when scoreResult has no winner', () => {
      const game = createMockGame();

      const scoreResult: ReturnType<typeof calculateRoundScores> = {
        bidderMadeBid: true,
        playerScores: [
          {
            playerId: 'p1',
            trickPoints: 50,
            marriagePoints: 0,
            totalRoundPoints: 50,
            scoreChange: 50,
            newTotalScore: 50,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
          {
            playerId: 'p2',
            trickPoints: 30,
            marriagePoints: 0,
            totalRoundPoints: 30,
            scoreChange: 30,
            newTotalScore: 30,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
          {
            playerId: 'p3',
            trickPoints: 40,
            marriagePoints: 0,
            totalRoundPoints: 40,
            scoreChange: 40,
            newTotalScore: 40,
            wasOnBarrel: false,
            fellOffBarrel: false,
          },
        ],
        winner: null,
      };

      applyScores(game, scoreResult);

      expect(game.winner).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Barrel edge case: bidder fails bid while on barrel
  // -----------------------------------------------------------------------
  describe('barrel: bidder fails bid while on barrel', () => {
    it('loses bid amount and may drop below 800', () => {
      // p1 on barrel at 820, bids 150, fails -> 820 - 150 = 670
      const game = createMockGame({
        scores: {
          p1: { totalScore: 820, isOnBarrel: true, barrelAttempts: 1 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 150,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 40, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(false);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.scoreChange).toBe(-150);
      expect(bidderScore.newTotalScore).toBe(670);
      expect(bidderScore.fellOffBarrel).toBe(true);

      // Barrel attempts reset since dropped below 800
      expect(game.scores['p1'].barrelAttempts).toBe(0);
      expect(game.scores['p1'].isOnBarrel).toBe(false);
    });

    it('stays on barrel if bid failure keeps score >= 800', () => {
      // p1 on barrel at 910, bids 100, fails -> 910 - 100 = 810 (still >= 800)
      const game = createMockGame({
        scores: {
          p1: { totalScore: 910, isOnBarrel: true, barrelAttempts: 1 },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 100,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 50, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 35, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 35, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);

      expect(result.bidderMadeBid).toBe(false);

      const bidderScore = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.scoreChange).toBe(-100);
      expect(bidderScore.newTotalScore).toBe(810);
      expect(bidderScore.fellOffBarrel).toBe(false);

      // Still on barrel
      expect(game.scores['p1'].isOnBarrel).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Integration: calculateRoundScores + applyScores together
  // -----------------------------------------------------------------------
  describe('integration: calculateRoundScores + applyScores', () => {
    it('produces consistent results when chained together', () => {
      const game = createMockGame({
        scores: {
          p1: { totalScore: 300, roundScores: [200, 100] },
          p2: { totalScore: 200, roundScores: [100, 100] },
          p3: { totalScore: 150, roundScores: [80, 70] },
        },
        currentRound: {
          bidWinner: 'p1',
          finalBid: 120,
        },
        roundPlayers: {
          p1: { pointsFromTricks: 80, marriagePoints: 40, tricksWon: [makeTrick()] },
          p2: { pointsFromTricks: 26, tricksWon: [makeTrick()] },
          p3: { pointsFromTricks: 14, tricksWon: [makeTrick()] },
        },
      });

      const result = calculateRoundScores(game);
      applyScores(game, result);

      // Bidder: 80+40=120 >= 120 bid -> roundToTen(120) = 120
      expect(game.scores['p1'].totalScore).toBe(420);
      expect(game.scores['p1'].roundScores).toEqual([200, 100, 120]);

      // p2: roundToTen(26) = 30
      expect(game.scores['p2'].totalScore).toBe(230);
      expect(game.scores['p2'].roundScores).toEqual([100, 100, 30]);

      // p3: roundToTen(14) = 10
      expect(game.scores['p3'].totalScore).toBe(160);
      expect(game.scores['p3'].roundScores).toEqual([80, 70, 10]);

      expect(game.winner).toBeNull();
    });
  });
});
