import type { Card, PlayerId, PlayerRoundResult, RoundScoreResult, RoundSummary, Scores } from './types';
import { RULES } from './rules';
import { marriagesInHand } from './cards';

/** Round to nearest 10; remainder >= 6 rounds up (15 → 10, 16 → 20). */
export function roundToTen(points: number): number {
  const remainder = points % 10;
  return remainder >= RULES.roundUpFrom ? points - remainder + 10 : points - remainder;
}

/** On the barrel: 800 ≤ total < 1000. */
export function isOnBarrel(total: number): boolean {
  return total >= RULES.barrelAt && total < RULES.winAt;
}

export interface ScoringInput {
  /** All seats, clockwise. */
  order: PlayerId[];
  bidder: PlayerId;
  bid: number;
  dealer: PlayerId;
  /** 4 players: the dealer sits out. */
  sittingOut: PlayerId | null;
  /** Totals before this round. */
  totals: Record<PlayerId, number>;
  trickPoints: Record<PlayerId, number>;
  tricksTaken: Record<PlayerId, number>;
  /** Sum of declared marriage values (counted only if the player took a trick). */
  declaredMarriagePoints: Record<PlayerId, number>;
  /** Sitting-out dealer bonus: talon marriages + 50 per talon ace. */
  talonBonus: number;
}

/**
 * Scores a played round (spec §3.9–3.11).
 * - Bidder: made if raw (tricks + counted marriages) >= bid → +roundToTen(raw); else −bid.
 * - Defenders: +roundToTen(tricks + counted marriages); 0 on the barrel.
 * - Sitting-out dealer: +roundToTen(talon bonus); 0 on the barrel.
 */
export function scoreRound(input: ScoringInput): RoundScoreResult {
  const playerScores: PlayerRoundResult[] = input.order.map(id => {
    const isBidder = id === input.bidder;
    const sittingOut = id === input.sittingOut;
    const prev = input.totals[id] ?? 0;
    const wasOnBarrel = isOnBarrel(prev);
    const trickPoints = sittingOut ? 0 : input.trickPoints[id] ?? 0;
    const wonTrick = (input.tricksTaken[id] ?? 0) > 0;
    const marriagePoints = sittingOut
      ? input.talonBonus
      : wonTrick
        ? input.declaredMarriagePoints[id] ?? 0
        : 0;
    const totalRoundPoints = trickPoints + marriagePoints;
    let scoreChange: number;
    if (isBidder) scoreChange = totalRoundPoints >= input.bid ? roundToTen(totalRoundPoints) : -input.bid;
    else if (wasOnBarrel) scoreChange = 0;
    else scoreChange = roundToTen(totalRoundPoints);
    const newTotalScore = prev + scoreChange;
    return {
      playerId: id,
      trickPoints,
      marriagePoints,
      totalRoundPoints,
      scoreChange,
      newTotalScore,
      wasOnBarrel,
      fellOffBarrel: wasOnBarrel && newTotalScore < RULES.barrelAt,
      isDealer: id === input.dealer,
      sittingOut,
    };
  });
  const bidder = playerScores.find(p => p.playerId === input.bidder)!;
  return {
    bidderMadeBid: bidder.totalRoundPoints >= input.bid,
    playerScores,
    winner: pickWinner(totalsOf(playerScores), input.bidder, input.order),
  };
}

export interface ThrowInput {
  order: PlayerId[];
  dealer: PlayerId;
  bidder: PlayerId;
  bid: number;
  sittingOut: PlayerId | null;
  totals: Record<PlayerId, number>;
}

/** Throw-in: at 100 nothing changes; above 100 bidder −bid, other active players +⌊120/others⌋ unless on the barrel. */
export function scoreThrow(input: ThrowInput): RoundScoreResult {
  const others = input.order.filter(id => id !== input.bidder && id !== input.sittingOut);
  const share = Math.floor(RULES.throwPool / others.length);
  const playerScores: PlayerRoundResult[] = input.order.map(id => {
    const prev = input.totals[id] ?? 0;
    const wasOnBarrel = isOnBarrel(prev);
    let scoreChange = 0;
    if (input.bid > RULES.autoBid) {
      if (id === input.bidder) scoreChange = -input.bid;
      else if (others.includes(id) && !wasOnBarrel) scoreChange = share;
    }
    const newTotalScore = prev + scoreChange;
    return {
      playerId: id,
      trickPoints: 0,
      marriagePoints: 0,
      totalRoundPoints: 0,
      scoreChange,
      newTotalScore,
      wasOnBarrel,
      fellOffBarrel: wasOnBarrel && newTotalScore < RULES.barrelAt,
      isDealer: id === input.dealer,
      sittingOut: id === input.sittingOut,
    };
  });
  return {
    bidderMadeBid: false,
    playerScores,
    winner: pickWinner(totalsOf(playerScores), input.bidder, input.order),
  };
}

/** Anyone >= 1000 wins. Several: the bidder if among them, else highest total, else first clockwise from the bidder. */
export function pickWinner(totals: Record<PlayerId, number>, bidder: PlayerId, order: PlayerId[]): PlayerId | null {
  const reached = order.filter(id => (totals[id] ?? 0) >= RULES.winAt);
  if (reached.length === 0) return null;
  if (reached.includes(bidder)) return bidder;
  const best = Math.max(...reached.map(id => totals[id]));
  const start = order.indexOf(bidder);
  for (let k = 1; k <= order.length; k++) {
    const id = order[(start + k) % order.length];
    if (reached.includes(id) && totals[id] === best) return id;
  }
  return null;
}

export function applyScoreResult(scores: Scores, result: RoundScoreResult): Scores {
  const next: Scores = {};
  for (const [id, s] of Object.entries(scores)) next[id] = { total: s.total, history: [...s.history] };
  for (const p of result.playerScores) {
    const prev = next[p.playerId] ?? { total: 0, history: [] };
    next[p.playerId] = { total: p.newTotalScore, history: [...prev.history, p.scoreChange] };
  }
  return next;
}

export function summarizeRound(meta: Omit<RoundSummary, 'players'>, result: RoundScoreResult): RoundSummary {
  return { ...meta, players: result.playerScores.map(p => ({ ...p })) };
}

/** 4-player sitting-out dealer bonus: marriages in the talon + 50 per ace in the talon. */
export function talonBonus(talon: Card[]): number {
  const marriages = marriagesInHand(talon).reduce((sum, suit) => sum + RULES.marriageValues[suit], 0);
  const aces = talon.filter(c => c.rank === 'A').length;
  return marriages + aces * RULES.talonAcePoints;
}

function totalsOf(players: PlayerRoundResult[]): Record<PlayerId, number> {
  return Object.fromEntries(players.map(p => [p.playerId, p.newTotalScore]));
}
