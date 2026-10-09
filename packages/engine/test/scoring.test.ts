import { describe, it, expect } from 'vitest';
import type { RoundScoreResult } from '../src/types';
import { createDeck, handPoints, parseCards } from '../src/cards';
import {
  scoreRound, scoreThrow, pickWinner, applyScoreResult, summarizeRound, roundToTen, isOnBarrel,
  talonBonus, type ScoringInput,
} from '../src/scoring';

interface MockPlayerOptions {
  id: string;
  totalScore?: number;
  isOnBarrel?: boolean; // informational only — barrel is derived from totalScore
  pointsFromTricks?: number;
  marriagePoints?: number;
  tricksWon?: unknown[];
}
interface MockGameOptions {
  players: MockPlayerOptions[];
  bidWinnerId: string;
  finalBid: number;
  dealer?: string;
  isDealerSittingOut?: boolean;
  dealerMarriagePoints?: number;
}

function buildGameState(opts: MockGameOptions): ScoringInput {
  const ids = opts.players.map(p => p.id);
  const dealer = opts.dealer ?? ids[0];
  const by = <T>(f: (p: MockPlayerOptions) => T): Record<string, T> =>
    Object.fromEntries(opts.players.map(p => [p.id, f(p)]));
  return {
    order: ids,
    bidder: opts.bidWinnerId,
    bid: opts.finalBid,
    dealer,
    sittingOut: opts.isDealerSittingOut ? dealer : null,
    totals: by(p => p.totalScore ?? 0),
    trickPoints: by(p => p.pointsFromTricks ?? 0),
    tricksTaken: by(p => (p.tricksWon ?? ((p.pointsFromTricks ?? 0) > 0 ? [[]] : [])).length),
    declaredMarriagePoints: by(p => p.marriagePoints ?? 0),
    talonBonus: opts.dealerMarriagePoints ?? 0,
  };
}
const get = (r: RoundScoreResult, id: string) => r.playerScores.find(s => s.playerId === id)!;
const three = (p1: Partial<MockPlayerOptions>, p2: Partial<MockPlayerOptions> = {}, p3: Partial<MockPlayerOptions> = {}) =>
  [{ id: 'p1', ...p1 }, { id: 'p2', ...p2 }, { id: 'p3', ...p3 }];

describe('scoring', () => {
  describe('roundToTen (indirect)', () => {
    const nonBidder = (pts: number, tricksWon: unknown[] = [[]]) =>
      get(scoreRound(buildGameState({
        players: three({ pointsFromTricks: pts, tricksWon }, { pointsFromTricks: pts === 0 ? 100 : 0 }, { pointsFromTricks: 0 }),
        bidWinnerId: 'p2', finalBid: 100, dealer: 'p3',
      })), 'p1').scoreChange;
    it('rounds 15 down to 10 (remainder 5 < 6 rounds down)', () => expect(nonBidder(15)).toBe(10));
    it('rounds 16 up to 20 (remainder 6 >= 6 rounds up)', () => expect(nonBidder(16)).toBe(20));
    it('rounds 25 down to 20 (remainder 5 < 6)', () => expect(nonBidder(25)).toBe(20));
    it('rounds 26 up to 30 (remainder 6 >= 6)', () => expect(nonBidder(26)).toBe(30));
    it('keeps exact multiples of 10 unchanged', () => expect(nonBidder(30)).toBe(30));
    it('rounds 0 to 0', () => expect(nonBidder(0, [])).toBe(0));
  });

  describe('bidder scoring', () => {
    it('scores earned points (rounded) when bidder makes the bid exactly', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(true);
      expect(get(r, 'bidder').scoreChange).toBe(100);
      expect(get(r, 'bidder').newTotalScore).toBe(100);
    });
    it('scores earned points when bidder exceeds bid', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 76, marriagePoints: 80, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 22, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 22, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(true);
      expect(get(r, 'bidder').scoreChange).toBe(160);
    });
    it('loses bid amount when bidder fails to reach bid', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 30, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').scoreChange).toBe(-120);
      expect(get(r, 'bidder').newTotalScore).toBe(-120);
    });
    it('marriage points count for bidder only if they won at least one trick', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 0, marriagePoints: 100, tricksWon: [] }, { id: 'p2', pointsFromTricks: 60, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 60, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').totalRoundPoints).toBe(0);
      expect(get(r, 'bidder').scoreChange).toBe(-100);
    });
    it('marriage points count for bidder when they won at least one trick', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 40, marriagePoints: 80, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 40, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 40, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(true);
      expect(get(r, 'bidder').totalRoundPoints).toBe(120);
      expect(get(r, 'bidder').scoreChange).toBe(120);
    });
    it('allows negative total scores', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: -50, pointsFromTricks: 30, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 45, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 45, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 200, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').scoreChange).toBe(-200);
      expect(get(r, 'bidder').newTotalScore).toBe(-250);
    });
  });

  describe('non-bidder scoring', () => {
    it('rounds non-bidder trick points to nearest 10', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 70, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 28, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 22, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(30);
      expect(get(r, 'p3').scoreChange).toBe(20);
    });
    it('includes marriage points for non-bidder who won at least one trick', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 30, marriagePoints: 40, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(70);
    });
    it('ignores marriage points for non-bidder who won no tricks', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 90, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 0, marriagePoints: 60, tricksWon: [] }, { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').marriagePoints).toBe(0);
      expect(get(r, 'p2').scoreChange).toBe(0);
    });
    it('non-bidder score does not trigger barrel check (no scoreChange penalty)', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] }, { id: 'p2', totalScore: 600, pointsFromTricks: 20, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(20);
      expect(get(r, 'p2').newTotalScore).toBe(620);
    });
  });

  describe('barrel rules for bidder', () => {
    it('bidder on barrel who reaches 1000 wins the game', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 880, pointsFromTricks: 120, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 0, tricksWon: [] }, { id: 'p3', pointsFromTricks: 0, tricksWon: [] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(true);
      expect(r.winner).toBe('bidder');
      expect(get(r, 'bidder').newTotalScore).toBe(1000);
      expect(get(r, 'bidder').wasOnBarrel).toBe(true);
      expect(get(r, 'bidder').fellOffBarrel).toBe(false);
    });
    it('bidder on barrel who exceeds 1000 also wins', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 900, pointsFromTricks: 110, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 5, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 5, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 110, dealer: 'p3',
      }));
      expect(r.winner).toBe('bidder');
      expect(get(r, 'bidder').newTotalScore).toBe(1010);
    });
    it('bidder on barrel who makes bid but does not reach 1000 adds points normally', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 800, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(true);
      expect(r.winner).toBeNull();
      expect(get(r, 'bidder').newTotalScore).toBe(900);
      expect(get(r, 'bidder').wasOnBarrel).toBe(true);
      expect(get(r, 'bidder').fellOffBarrel).toBe(false);
    });
    it('bidder on barrel who fails bid loses bid amount and may fall off barrel', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 800, pointsFromTricks: 50, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').scoreChange).toBe(-120);
      expect(get(r, 'bidder').newTotalScore).toBe(680);
      expect(get(r, 'bidder').wasOnBarrel).toBe(true);
      expect(get(r, 'bidder').fellOffBarrel).toBe(true);
    });
    it('bidder on barrel who fails bid but stays above 800 does not fall off', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 950, pointsFromTricks: 50, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').scoreChange).toBe(-120);
      expect(get(r, 'bidder').newTotalScore).toBe(830);
      expect(get(r, 'bidder').wasOnBarrel).toBe(true);
      expect(get(r, 'bidder').fellOffBarrel).toBe(false);
    });
    it('falls off the barrel at 690 — no attempt counter in the rebuild (was: attempt counter resets on fall)', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 810, pointsFromTricks: 30, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 45, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 45, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      expect(get(r, 'bidder').fellOffBarrel).toBe(true);
      expect(get(r, 'bidder').newTotalScore).toBe(690);
      expect(isOnBarrel(690)).toBe(false);
    });
    it('reaching 1000 from the barrel wins regardless of earlier attempts (was: attempt counter resets at 1000)', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 900, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.winner).toBe('bidder');
    });
  });

  describe('non-bidder on barrel', () => {
    it('non-bidder on barrel scores 0 for the round', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] }, { id: 'p2', totalScore: 850, pointsFromTricks: 20, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(0);
      expect(get(r, 'p2').newTotalScore).toBe(850);
      expect(get(r, 'p2').wasOnBarrel).toBe(true);
    });
    it('non-bidder on barrel with marriage points still scores 0', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 60, tricksWon: [[]] }, { id: 'p2', totalScore: 800, pointsFromTricks: 30, marriagePoints: 40, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 30, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(0);
      expect(get(r, 'p2').newTotalScore).toBe(800);
    });
    it('non-bidder at exactly 800 is on barrel and scores 0', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] }, { id: 'p2', totalScore: 800, pointsFromTricks: 20, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').scoreChange).toBe(0);
      expect(get(r, 'p2').newTotalScore).toBe(800);
      expect(get(r, 'p2').wasOnBarrel).toBe(true);
    });
  });

  describe('4-player dealer scoring (sitting out)', () => {
    const four = (dealerOpts: Partial<MockPlayerOptions>, bonus: number, bidderPts = 80, defPts = 20) => scoreRound(buildGameState({
      players: [
        { id: 'bidder', pointsFromTricks: bidderPts, tricksWon: [[]] },
        { id: 'p2', pointsFromTricks: defPts, tricksWon: [[]] },
        { id: 'p3', pointsFromTricks: defPts, tricksWon: [[]] },
        { id: 'dealer', pointsFromTricks: 0, tricksWon: [], ...dealerOpts },
      ],
      bidWinnerId: 'bidder', finalBid: 100, dealer: 'dealer', isDealerSittingOut: true, dealerMarriagePoints: bonus,
    }));
    it('sitting-out dealer gets talon marriage points rounded to 10', () => {
      const d = get(four({}, 60), 'dealer');
      expect(d.scoreChange).toBe(60);
      expect(d.marriagePoints).toBe(60);
      expect(d.trickPoints).toBe(0);
      expect(d.sittingOut).toBe(true);
      expect(d.isDealer).toBe(true);
    });
    it('sitting-out dealer with 0 talon marriage points scores 0', () => {
      const d = get(four({}, 0, 60, 30), 'dealer');
      expect(d.scoreChange).toBe(0);
      expect(d.marriagePoints).toBe(0);
    });
    it('sitting-out dealer talon marriage points get rounded to nearest 10', () => {
      expect(get(four({}, 46), 'dealer').scoreChange).toBe(50);
    });
    it('sitting-out dealer on barrel scores 0 despite talon marriages', () => {
      const d = get(four({ totalScore: 820 }, 80), 'dealer');
      expect(d.scoreChange).toBe(0);
      expect(d.newTotalScore).toBe(820);
    });
    it('sitting-out dealer trick points are always 0', () => {
      const d = get(four({ pointsFromTricks: 50, tricksWon: [[]] }, 40, 60, 30), 'dealer');
      expect(d.trickPoints).toBe(0);
      expect(d.scoreChange).toBe(40);
    });
  });

  describe('getTotalPoints', () => {
    it('returns 120 (sum of all card point values in deck)', () => {
      expect(handPoints(createDeck())).toBe(120);
    });
  });

  describe('applyScoreResult (was applyScores)', () => {
    it('updates player totalScore and roundScores in the game state', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 200, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', totalScore: 100, pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', totalScore: 100, pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      const before = { bidder: { total: 200, history: [] }, p2: { total: 100, history: [] }, p3: { total: 100, history: [] } };
      const after = applyScoreResult(before, r);
      expect(after.bidder.total).toBe(300);
      expect(after.bidder.history).toEqual([100]);
      expect(after.p2.total).toBe(110);
      expect(after.p2.history).toEqual([10]);
      expect(after.p3.total).toBe(110);
      expect(after.p3.history).toEqual([10]);
      expect(before.bidder.total).toBe(200);
      expect(before.bidder.history).toEqual([]);
    });
    it('sets game.winner when scoreResult has a winner', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 900, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.winner).toBe('bidder');
      const after = applyScoreResult({ bidder: { total: 900, history: [50] }, p2: { total: 0, history: [] }, p3: { total: 0, history: [] } }, r);
      expect(after.bidder.total).toBe(1000);
      expect(after.bidder.history).toEqual([50, 100]);
    });
    it('does not set game.winner when there is no winner', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 0, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.winner).toBeNull();
      const after = applyScoreResult({ bidder: { total: 0, history: [] }, p2: { total: 0, history: [] }, p3: { total: 0, history: [] } }, r);
      expect(after.bidder.total).toBe(100);
      expect(Object.values(after).every(x => x.total < 1000)).toBe(true);
    });
  });

  describe('summarizeRound (was createRoundResult)', () => {
    it('returns a RoundResult with correct structure', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 80, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 20, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 20, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 110, dealer: 'p3',
      }));
      const s = summarizeRound({ number: 1, dealer: 'p3', bidder: 'bidder', bid: 110, outcome: r.bidderMadeBid ? 'made' : 'failed', wykladana: false }, r);
      expect(s.number).toBe(1);
      expect(s.bidder).toBe('bidder');
      expect(s.bid).toBe(110);
      expect(s.outcome).toBe('failed');
      expect(s.players).toHaveLength(3);
      const b = s.players.find(p => p.playerId === 'bidder')!;
      expect(b.scoreChange).toBe(-110);
      expect(b.trickPoints).toBe(80);
    });
    it('includes wasOnBarrel and fellOffBarrel in player results', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 800, pointsFromTricks: 50, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 35, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 35, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 120, dealer: 'p3',
      }));
      const s = summarizeRound({ number: 1, dealer: 'p3', bidder: 'bidder', bid: 120, outcome: 'failed', wykladana: false }, r);
      const b = s.players.find(p => p.playerId === 'bidder')!;
      expect(b.wasOnBarrel).toBe(true);
      expect(b.fellOffBarrel).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('when several players reach 1000, the bidder wins if among them', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 900, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', totalScore: 790, pointsFromTricks: 120, marriagePoints: 100, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 0, tricksWon: [] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'bidder').newTotalScore).toBe(1000);
      expect(get(r, 'p2').newTotalScore).toBe(1010);
      expect(r.winner).toBe('bidder');
    });
    it('when several non-bidders reach 1000, the highest total wins', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 500, pointsFromTricks: 40, tricksWon: [[]] }, { id: 'p2', totalScore: 790, pointsFromTricks: 120, marriagePoints: 100, tricksWon: [[]] }, { id: 'p3', totalScore: 780, pointsFromTricks: 140, marriagePoints: 100, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'bidder').newTotalScore).toBe(400);
      expect(get(r, 'p2').newTotalScore).toBe(1010);
      expect(get(r, 'p3').newTotalScore).toBe(1020);
      expect(r.winner).toBe('p3');
    });
    it('when non-bidders tie on the highest total, the first clockwise from the bidder wins', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 500, pointsFromTricks: 40, tricksWon: [[]] }, { id: 'p2', totalScore: 790, pointsFromTricks: 120, marriagePoints: 100, tricksWon: [[]] }, { id: 'p3', totalScore: 790, pointsFromTricks: 120, marriagePoints: 100, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(get(r, 'p2').newTotalScore).toBe(1010);
      expect(get(r, 'p3').newTotalScore).toBe(1010);
      expect(r.winner).toBe('p2');
    });
    it('updates isOnBarrel flag on scores when player reaches barrel threshold', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', totalScore: 700, pointsFromTricks: 100, tricksWon: [[]] }, { id: 'p2', pointsFromTricks: 10, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 10, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(isOnBarrel(get(r, 'bidder').newTotalScore)).toBe(true);
    });
    it('bidder with 0 points from tricks and no marriages fails bid', () => {
      const r = scoreRound(buildGameState({
        players: [{ id: 'bidder', pointsFromTricks: 0, tricksWon: [] }, { id: 'p2', pointsFromTricks: 60, tricksWon: [[]] }, { id: 'p3', pointsFromTricks: 60, tricksWon: [[]] }],
        bidWinnerId: 'bidder', finalBid: 100, dealer: 'p3',
      }));
      expect(r.bidderMadeBid).toBe(false);
      expect(get(r, 'bidder').scoreChange).toBe(-100);
    });
  });
});

describe('rebuild additions', () => {
  it('roundToTen and isOnBarrel boundaries', () => {
    expect([0, 5, 6, 14, 15, 16, 101, 136].map(roundToTen)).toEqual([0, 0, 10, 10, 10, 20, 100, 140]);
    expect([799, 800, 999, 1000].map(isOnBarrel)).toEqual([false, true, true, false]);
  });
  it('rounding never helps the bidder: 96 raw against 100 fails', () => {
    const r = scoreRound(buildGameState({
      players: three({ pointsFromTricks: 96 }, { pointsFromTricks: 12 }, { pointsFromTricks: 12 }),
      bidWinnerId: 'p1', finalBid: 100, dealer: 'p3',
    }));
    expect(r.bidderMadeBid).toBe(false);
    expect(get(r, 'p1').scoreChange).toBe(-100);
  });
  it('pickWinner: bidder wins ties, else highest, else first clockwise from bidder', () => {
    expect(pickWinner({ a: 1000, b: 1100, c: 0 }, 'a', ['a', 'b', 'c'])).toBe('a');
    expect(pickWinner({ a: 500, b: 1000, c: 1050 }, 'a', ['a', 'b', 'c'])).toBe('c');
    expect(pickWinner({ a: 500, b: 1010, c: 1010 }, 'b', ['a', 'b', 'c'])).toBe('b');
    expect(pickWinner({ a: 1010, b: 500, c: 1010 }, 'b', ['a', 'b', 'c'])).toBe('c');
    expect(pickWinner({ a: 999, b: 0, c: 0 }, 'a', ['a', 'b', 'c'])).toBeNull();
  });
  it('scoreThrow at 100 changes nothing', () => {
    const r = scoreThrow({ order: ['a', 'b', 'c'], dealer: 'c', bidder: 'a', bid: 100, sittingOut: null, totals: { a: 50, b: 0, c: 0 } });
    expect(r.playerScores.map(p => p.scoreChange)).toEqual([0, 0, 0]);
    expect(r.winner).toBeNull();
  });
  it('scoreThrow above 100: bidder -bid, others +60, barrel 0, sitting-out dealer 0', () => {
    const r = scoreThrow({ order: ['a', 'b', 'c', 'd'], dealer: 'd', bidder: 'a', bid: 130, sittingOut: 'd', totals: { a: 0, b: 850, c: 100, d: 0 } });
    expect(r.playerScores.map(p => p.scoreChange)).toEqual([-130, 0, 60, 0]);
    expect(r.playerScores[2].newTotalScore).toBe(160);
  });
  it('talonBonus: marriages in talon + 50 per ace', () => {
    expect(talonBonus(parseCards('KS QS AH'))).toBe(90);
    expect(talonBonus(parseCards('9S JD 10C'))).toBe(0);
    expect(talonBonus(parseCards('AS AD AH'))).toBe(150);
  });
});
