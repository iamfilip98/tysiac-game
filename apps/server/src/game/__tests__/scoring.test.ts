import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState, GamePlayer, PlayerScore, RoundState, PlayerRoundState } from '@tysiac/shared';
import { WINNING_SCORE, BARREL_THRESHOLD } from '@tysiac/shared';

// Mock debugService before importing scoring module
vi.mock('../../services/debugService.js', () => ({
  logDebug: vi.fn(),
}));

import { calculateRoundScores, applyScores, createRoundResult, getTotalPoints } from '../scoring.js';

// ---------------------------------------------------------------------------
// Helper: build a minimal GameState for scoring tests
// ---------------------------------------------------------------------------

interface MockPlayerOptions {
  id: string;
  name?: string;
  totalScore?: number;
  isOnBarrel?: boolean;
  barrelAttempts?: number;
  pointsFromTricks?: number;
  marriagePoints?: number;
  tricksWon?: any[];
}

interface MockGameOptions {
  players: MockPlayerOptions[];
  bidWinnerId: string;
  finalBid: number;
  dealer?: string;
  isDealerSittingOut?: boolean;
  dealerMarriagePoints?: number;
}

function buildGameState(opts: MockGameOptions): GameState {
  const gamePlayers: GamePlayer[] = opts.players.map((p, i) => ({
    id: p.id,
    name: p.name ?? `Player ${i + 1}`,
    isAI: false,
    seatIndex: i,
  }));

  const scores: Record<string, PlayerScore> = {};
  const roundPlayers: Record<string, PlayerRoundState> = {};

  for (const p of opts.players) {
    scores[p.id] = {
      playerId: p.id,
      totalScore: p.totalScore ?? 0,
      roundScores: [],
      isOnBarrel: p.isOnBarrel ?? false,
      barrelAttempts: p.barrelAttempts ?? 0,
    };

    roundPlayers[p.id] = {
      playerId: p.id,
      hand: [],
      tricksWon: p.tricksWon ?? (p.pointsFromTricks !== undefined && p.pointsFromTricks > 0 ? [[]] : []),
      pointsFromTricks: p.pointsFromTricks ?? 0,
      declaredMarriages: [],
      marriagePoints: p.marriagePoints ?? 0,
    };
  }

  const dealerId = opts.dealer ?? opts.players[0].id;

  const currentRound: RoundState = {
    roundNumber: 1,
    dealer: dealerId,
    talon: [],
    talonRevealed: true,
    trumpSuit: null,
    bidWinner: opts.bidWinnerId,
    finalBid: opts.finalBid,
    players: roundPlayers,
    currentTrick: null,
    completedTricks: 8,
    cardsToDistribute: [],
    isDealerSittingOut: opts.isDealerSittingOut ?? false,
    dealerMarriagePoints: opts.dealerMarriagePoints ?? 0,
    talonMarriages: [],
  };

  return {
    id: 'test-game-1',
    roomId: 'test-room-1',
    phase: 'roundScoring',
    players: gamePlayers,
    scores,
    currentRound,
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // roundToTen (tested indirectly through calculateRoundScores)
  // =========================================================================
  describe('roundToTen (indirect)', () => {
    it('rounds 15 up to 20 (remainder 5 < 6 rounds down... wait, 5 < 6 so 15 -> 10)', () => {
      // 15 has remainder 5, which is < 6, so rounds DOWN to 10
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 15, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      // Non-bidder: roundToTen(15) = 10 (remainder 5 < 6)
      expect(p1Score.scoreChange).toBe(10);
    });

    it('rounds 16 up to 20 (remainder 6 >= 6 rounds up)', () => {
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 16, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(p1Score.scoreChange).toBe(20);
    });

    it('rounds 25 down to 20 (remainder 5 < 6)', () => {
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 25, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(p1Score.scoreChange).toBe(20);
    });

    it('rounds 26 up to 30 (remainder 6 >= 6)', () => {
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 26, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(p1Score.scoreChange).toBe(30);
    });

    it('keeps exact multiples of 10 unchanged', () => {
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(p1Score.scoreChange).toBe(30);
    });

    it('rounds 0 to 0', () => {
      const game = buildGameState({
        players: [
          { id: 'p1', pointsFromTricks: 0, tricksWon: [] },
          { id: 'p2', pointsFromTricks: 100 },
          { id: 'p3', pointsFromTricks: 0 },
        ],
        bidWinnerId: 'p2',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p1Score = result.playerScores.find(s => s.playerId === 'p1')!;
      expect(p1Score.scoreChange).toBe(0);
    });
  });

  // =========================================================================
  // Bidder scoring
  // =========================================================================
  describe('bidder scoring', () => {
    it('scores earned points (rounded) when bidder makes the bid exactly', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(true);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.scoreChange).toBe(100);
      expect(bidderScore.newTotalScore).toBe(100);
    });

    it('scores earned points when bidder exceeds bid', () => {
      // Bidder bid 100 but earned 116 trick points + 40 marriage = 156
      // roundToTen(156) = 160
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 76, marriagePoints: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 22, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 22, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(true);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // roundToTen(76 + 80 = 156) = 160
      expect(bidderScore.scoreChange).toBe(160);
    });

    it('loses bid amount when bidder fails to reach bid', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.scoreChange).toBe(-120);
      expect(bidderScore.newTotalScore).toBe(-120);
    });

    it('marriage points count for bidder only if they won at least one trick', () => {
      // Bidder has marriage points but no tricks won
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 0, marriagePoints: 100, tricksWon: [] },
          { id: 'p2', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 60, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // marriagePoints ignored because no tricks won -> totalRoundPoints = 0 < 100
      expect(bidderScore.totalRoundPoints).toBe(0);
      expect(bidderScore.scoreChange).toBe(-100);
    });

    it('marriage points count for bidder when they won at least one trick', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 40, marriagePoints: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 40, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 40, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      // totalRoundPoints = 40 + 80 = 120 >= 120
      expect(result.bidderMadeBid).toBe(true);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.totalRoundPoints).toBe(120);
      // roundToTen(120) = 120
      expect(bidderScore.scoreChange).toBe(120);
    });

    it('allows negative total scores', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: -50, pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 45, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 45, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 200,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.scoreChange).toBe(-200);
      expect(bidderScore.newTotalScore).toBe(-250);
    });
  });

  // =========================================================================
  // Non-bidder scoring
  // =========================================================================
  describe('non-bidder scoring', () => {
    it('rounds non-bidder trick points to nearest 10', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 70, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 28, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 22, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      const p3Score = result.playerScores.find(s => s.playerId === 'p3')!;
      // roundToTen(28) = 30 (remainder 8 >= 6)
      expect(p2Score.scoreChange).toBe(30);
      // roundToTen(22) = 20 (remainder 2 < 6)
      expect(p3Score.scoreChange).toBe(20);
    });

    it('includes marriage points for non-bidder who won at least one trick', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 30, marriagePoints: 40, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      // roundToTen(30 + 40 = 70) = 70
      expect(p2Score.scoreChange).toBe(70);
    });

    it('ignores marriage points for non-bidder who won no tricks', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 90, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0, marriagePoints: 60, tricksWon: [] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.marriagePoints).toBe(0);
      expect(p2Score.scoreChange).toBe(0);
    });

    it('non-bidder score does not trigger barrel check (no scoreChange penalty)', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', totalScore: 600, pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      // roundToTen(20) = 20
      expect(p2Score.scoreChange).toBe(20);
      expect(p2Score.newTotalScore).toBe(620);
    });
  });

  // =========================================================================
  // Barrel rules for bidder
  // =========================================================================
  describe('barrel rules for bidder', () => {
    it('bidder on barrel who reaches 1000 wins the game', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 880, isOnBarrel: true, pointsFromTricks: 120, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 0, tricksWon: [] },
          { id: 'p3', pointsFromTricks: 0, tricksWon: [] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(true);
      expect(result.winner).toBe('bidder');
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // roundToTen(120) = 120; 880 + 120 = 1000
      expect(bidderScore.newTotalScore).toBe(1000);
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(false);
    });

    it('bidder on barrel who exceeds 1000 also wins', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 900, isOnBarrel: true, pointsFromTricks: 110, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 5, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 5, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 110,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.winner).toBe('bidder');
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // roundToTen(110) = 110; 900 + 110 = 1010
      expect(bidderScore.newTotalScore).toBe(1010);
    });

    it('bidder on barrel who makes bid but does not reach 1000 adds points normally', () => {
      // Made bid on barrel but not enough to reach 1000
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 800, isOnBarrel: true, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(true);
      expect(result.winner).toBeNull();
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // roundToTen(100) = 100; 800 + 100 = 900, still < 1000
      expect(bidderScore.newTotalScore).toBe(900);
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(false);
    });

    it('bidder on barrel who fails bid loses bid amount and may fall off barrel', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 800, isOnBarrel: true, barrelAttempts: 1, pointsFromTricks: 50, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // Failed bid: scoreChange = -120; 800 - 120 = 680 < 800 -> fell off barrel
      expect(bidderScore.scoreChange).toBe(-120);
      expect(bidderScore.newTotalScore).toBe(680);
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(true);
    });

    it('bidder on barrel who fails bid but stays above 800 does not fall off', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 950, isOnBarrel: true, pointsFromTricks: 50, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      // 950 - 120 = 830 >= 800 -> still on barrel
      expect(bidderScore.scoreChange).toBe(-120);
      expect(bidderScore.newTotalScore).toBe(830);
      expect(bidderScore.wasOnBarrel).toBe(true);
      expect(bidderScore.fellOffBarrel).toBe(false);
    });

    it('barrel attempt counter resets when bidder falls off barrel', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 810, isOnBarrel: true, barrelAttempts: 2, pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 45, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 45, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      // 810 - 120 = 690 < 800 -> fell off barrel
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.fellOffBarrel).toBe(true);
      // barrelAttempts should have been reset on the scores object
      expect(game.scores['bidder'].barrelAttempts).toBe(0);
    });

    it('barrel attempt counter resets when bidder reaches 1000', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 900, isOnBarrel: true, barrelAttempts: 2, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      expect(result.winner).toBe('bidder');
      expect(game.scores['bidder'].barrelAttempts).toBe(0);
    });
  });

  // =========================================================================
  // Non-bidder on barrel
  // =========================================================================
  describe('non-bidder on barrel', () => {
    it('non-bidder on barrel scores 0 for the round', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', totalScore: 850, isOnBarrel: true, pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(0);
      expect(p2Score.newTotalScore).toBe(850);
      expect(p2Score.wasOnBarrel).toBe(true);
    });

    it('non-bidder on barrel with marriage points still scores 0', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p2', totalScore: 800, isOnBarrel: true, pointsFromTricks: 30, marriagePoints: 40, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(0);
      expect(p2Score.newTotalScore).toBe(800);
    });

    it('non-bidder at exactly 800 is on barrel and scores 0', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', totalScore: 800, isOnBarrel: true, pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });
      const result = calculateRoundScores(game);
      const p2Score = result.playerScores.find(s => s.playerId === 'p2')!;
      expect(p2Score.scoreChange).toBe(0);
      expect(p2Score.newTotalScore).toBe(800);
      expect(p2Score.wasOnBarrel).toBe(true);
    });
  });

  // =========================================================================
  // 4-player dealer scoring
  // =========================================================================
  describe('4-player dealer scoring (sitting out)', () => {
    it('sitting-out dealer gets talon marriage points rounded to 10', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'dealer', pointsFromTricks: 0, tricksWon: [] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'dealer',
        isDealerSittingOut: true,
        dealerMarriagePoints: 60,
      });
      const result = calculateRoundScores(game);
      const dealerScore = result.playerScores.find(s => s.playerId === 'dealer')!;
      // roundToTen(60) = 60
      expect(dealerScore.scoreChange).toBe(60);
      expect(dealerScore.marriagePoints).toBe(60);
      expect(dealerScore.trickPoints).toBe(0);
      expect(dealerScore.sittingOut).toBe(true);
      expect(dealerScore.isDealer).toBe(true);
    });

    it('sitting-out dealer with 0 talon marriage points scores 0', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'dealer', pointsFromTricks: 0, tricksWon: [] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'dealer',
        isDealerSittingOut: true,
        dealerMarriagePoints: 0,
      });
      const result = calculateRoundScores(game);
      const dealerScore = result.playerScores.find(s => s.playerId === 'dealer')!;
      expect(dealerScore.scoreChange).toBe(0);
      expect(dealerScore.marriagePoints).toBe(0);
    });

    it('sitting-out dealer talon marriage points get rounded to nearest 10', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'dealer', pointsFromTricks: 0, tricksWon: [] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'dealer',
        isDealerSittingOut: true,
        dealerMarriagePoints: 46,
      });
      const result = calculateRoundScores(game);
      const dealerScore = result.playerScores.find(s => s.playerId === 'dealer')!;
      // roundToTen(46) = 50 (remainder 6 >= 6)
      expect(dealerScore.scoreChange).toBe(50);
    });

    it('sitting-out dealer on barrel scores 0 despite talon marriages', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'dealer', totalScore: 820, isOnBarrel: true, pointsFromTricks: 0, tricksWon: [] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'dealer',
        isDealerSittingOut: true,
        dealerMarriagePoints: 80,
      });
      const result = calculateRoundScores(game);
      const dealerScore = result.playerScores.find(s => s.playerId === 'dealer')!;
      // On barrel as non-bidder, so scoreChange = 0
      expect(dealerScore.scoreChange).toBe(0);
      expect(dealerScore.newTotalScore).toBe(820);
    });

    it('sitting-out dealer trick points are always 0', () => {
      // Even if playerState has trick points (shouldn't happen), sitting-out dealer gets 0
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] },
          { id: 'dealer', pointsFromTricks: 50, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'dealer',
        isDealerSittingOut: true,
        dealerMarriagePoints: 40,
      });
      const result = calculateRoundScores(game);
      const dealerScore = result.playerScores.find(s => s.playerId === 'dealer')!;
      expect(dealerScore.trickPoints).toBe(0);
      // Only marriage from talon counts: roundToTen(40) = 40
      expect(dealerScore.scoreChange).toBe(40);
    });
  });

  // =========================================================================
  // getTotalPoints
  // =========================================================================
  describe('getTotalPoints', () => {
    it('returns 120 (sum of all card point values in deck)', () => {
      // 9=0, J=2, Q=3, K=4, 10=10, A=11 => (0+2+3+4+10+11) * 4 suits = 30 * 4 = 120
      expect(getTotalPoints()).toBe(120);
    });
  });

  // =========================================================================
  // applyScores
  // =========================================================================
  describe('applyScores', () => {
    it('updates player totalScore and roundScores in the game state', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 200, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', totalScore: 100, pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', totalScore: 100, pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      const scoreResult = calculateRoundScores(game);
      // Reset scores to pre-apply state (calculateRoundScores mutates barrelAttempts but not totalScore)
      applyScores(game, scoreResult);

      const bidderScore = scoreResult.playerScores.find(s => s.playerId === 'bidder')!;
      expect(game.scores['bidder'].totalScore).toBe(bidderScore.newTotalScore);
      expect(game.scores['bidder'].roundScores).toContain(bidderScore.scoreChange);
    });

    it('sets game.winner when scoreResult has a winner', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 900, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      const scoreResult = calculateRoundScores(game);
      expect(scoreResult.winner).toBe('bidder');

      applyScores(game, scoreResult);
      expect(game.winner).toBe('bidder');
    });

    it('does not set game.winner when there is no winner', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 0, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      const scoreResult = calculateRoundScores(game);
      applyScores(game, scoreResult);
      expect(game.winner).toBeNull();
    });
  });

  // =========================================================================
  // createRoundResult
  // =========================================================================
  describe('createRoundResult', () => {
    it('returns a RoundResult with correct structure', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 20, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 110,
        dealer: 'p3',
      });

      const scoreResult = calculateRoundScores(game);
      const roundResult = createRoundResult(game, scoreResult);

      expect(roundResult.roundNumber).toBe(1);
      expect(roundResult.bidWinner).toBe('bidder');
      expect(roundResult.bid).toBe(110);
      expect(roundResult.bidderMadeBid).toBe(false);
      expect(roundResult.playerResults).toHaveLength(3);

      const bidderResult = roundResult.playerResults.find(r => r.playerId === 'bidder')!;
      expect(bidderResult.scoreChange).toBe(-110);
      expect(bidderResult.trickPoints).toBe(80);
    });

    it('includes wasOnBarrel and fellOffBarrel in player results', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 800, isOnBarrel: true, pointsFromTricks: 50, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 120,
        dealer: 'p3',
      });

      const scoreResult = calculateRoundScores(game);
      const roundResult = createRoundResult(game, scoreResult);

      const bidderResult = roundResult.playerResults.find(r => r.playerId === 'bidder')!;
      expect(bidderResult.wasOnBarrel).toBe(true);
      expect(bidderResult.fellOffBarrel).toBe(true);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('first player to reach 1000 wins even if others could also reach 1000', () => {
      // Both bidder and p2 could exceed 1000, but the first player in iteration wins
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 900, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', totalScore: 990, pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      const result = calculateRoundScores(game);
      // Bidder: 900 + 100 = 1000. p2 on barrel gets 0. So only bidder wins.
      expect(result.winner).toBe('bidder');
    });

    it('updates isOnBarrel flag on scores when player reaches barrel threshold', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', totalScore: 700, pointsFromTricks: 100, tricksWon: [[]] },
          { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      calculateRoundScores(game);
      // 700 + 100 = 800 -> now on barrel
      expect(game.scores['bidder'].isOnBarrel).toBe(true);
    });

    it('bidder with 0 points from tricks and no marriages fails bid', () => {
      const game = buildGameState({
        players: [
          { id: 'bidder', pointsFromTricks: 0, tricksWon: [] },
          { id: 'p2', pointsFromTricks: 60, tricksWon: [[]] },
          { id: 'p3', pointsFromTricks: 60, tricksWon: [[]] },
        ],
        bidWinnerId: 'bidder',
        finalBid: 100,
        dealer: 'p3',
      });

      const result = calculateRoundScores(game);
      expect(result.bidderMadeBid).toBe(false);
      const bidderScore = result.playerScores.find(s => s.playerId === 'bidder')!;
      expect(bidderScore.scoreChange).toBe(-100);
    });
  });
});
