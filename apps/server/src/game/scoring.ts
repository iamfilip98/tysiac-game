import type { GameState, PlayerScore, RoundResult, Suit } from '@tysiac/shared';
import { WINNING_SCORE, BARREL_THRESHOLD, MARRIAGE_VALUES, CARD_POINTS } from '@tysiac/shared';
import { logDebug } from '../services/debugService.js';

export interface RoundScoreResult {
  bidderMadeBid: boolean;
  playerScores: {
    playerId: string;
    trickPoints: number;
    marriagePoints: number;
    totalRoundPoints: number;
    scoreChange: number;
    newTotalScore: number;
    wasOnBarrel: boolean;
    fellOffBarrel: boolean;
    isDealer?: boolean;
    sittingOut?: boolean;
  }[];
  winner: string | null;
}

/**
 * Calculate scores for a completed round.
 *
 * Rules:
 * - Bidder must hit EXACT bid to score; otherwise loses bid amount
 * - Marriage points only count if the player won at least one trick
 * - Non-bidders can get marriage points if they won tricks
 * - Non-bidders round to nearest 10 (6+ rounds up), but only if under 800
 * - Players at/above 800 (on barrel) get 0 unless they're bidder
 * - Barrel: must reach 1000 or stay. 3 failed attempts = fall back to 800
 * - First to 1000 wins instantly
 * - Negative scores allowed
 */
export function calculateRoundScores(game: GameState): RoundScoreResult {
  const round = game.currentRound!;
  const bidWinnerId = round.bidWinner!;
  const finalBid = round.finalBid;

  const results: RoundScoreResult['playerScores'] = [];
  let gameWinner: string | null = null;

  for (const player of game.players) {
    const playerState = round.players[player.id];
    const currentScore = game.scores[player.id];
    const isBidder = player.id === bidWinnerId;
    const isSittingOutDealer = round.isDealerSittingOut && player.id === round.dealer;

    // Calculate trick points (0 for sitting-out dealer)
    const trickPoints = isSittingOutDealer ? 0 : playerState.pointsFromTricks;
    const wonAtLeastOneTrick = playerState.tricksWon.length > 0;

    // Marriage points:
    // - For sitting-out dealer: gets points from talon marriages
    // - For other players: only count if they won at least one trick
    let marriagePoints: number;
    if (isSittingOutDealer) {
      marriagePoints = round.dealerMarriagePoints;
    } else {
      marriagePoints = wonAtLeastOneTrick ? playerState.marriagePoints : 0;
    }

    // Total points earned this round
    const totalRoundPoints = trickPoints + marriagePoints;

    // Determine score change based on rules
    let scoreChange: number;
    const wasOnBarrel = currentScore.totalScore >= BARREL_THRESHOLD && currentScore.totalScore < WINNING_SCORE;
    let newTotalScore: number;
    let fellOffBarrel = false;

    if (isBidder) {
      // Bidder must hit exact bid
      if (totalRoundPoints >= finalBid) {
        scoreChange = roundToTen(totalRoundPoints); // Score what you earned
      } else {
        scoreChange = -finalBid; // Lose the bid amount
      }

      // Handle barrel rules for bidder
      if (wasOnBarrel) {
        const tentativeScore = currentScore.totalScore + scoreChange;

        if (tentativeScore >= WINNING_SCORE) {
          // Reached 1000, wins!
          newTotalScore = tentativeScore;
          currentScore.barrelAttempts = 0;
        } else {
          // Failed to reach 1000 while on barrel
          const newAttempts = currentScore.barrelAttempts + 1;

          if (newAttempts >= 3) {
            // Fall off barrel after 3 attempts - reset to 800
            newTotalScore = BARREL_THRESHOLD;
            fellOffBarrel = true;
            currentScore.barrelAttempts = 0;
            // Actual score change reflects the fall
            scoreChange = BARREL_THRESHOLD - currentScore.totalScore;
          } else {
            // Stay on barrel, score doesn't change
            newTotalScore = currentScore.totalScore;
            scoreChange = 0; // No actual change when staying on barrel
            currentScore.barrelAttempts = newAttempts;
          }
        }
      } else {
        newTotalScore = currentScore.totalScore + scoreChange;
      }
    } else {
      // Non-bidder (or sitting-out dealer)
      if (wasOnBarrel) {
        // On barrel: no points from defending (or spectating)
        scoreChange = 0;
        newTotalScore = currentScore.totalScore;
      } else if (isSittingOutDealer) {
        // Sitting-out dealer gets talon marriage points (rounded to nearest 10)
        scoreChange = roundToTen(marriagePoints);
        newTotalScore = currentScore.totalScore + scoreChange;
      } else {
        // Round to nearest 10 (6+ rounds up)
        // Non-bidders also get marriage points if they won tricks
        scoreChange = roundToTen(trickPoints + marriagePoints);
        newTotalScore = currentScore.totalScore + scoreChange;
      }
    }

    // Check for win
    if (newTotalScore >= WINNING_SCORE && !gameWinner) {
      gameWinner = player.id;
    }

    // Update barrel status
    const isNowOnBarrel = newTotalScore >= BARREL_THRESHOLD && newTotalScore < WINNING_SCORE;
    currentScore.isOnBarrel = isNowOnBarrel;

    const playerResult = {
      playerId: player.id,
      trickPoints,
      marriagePoints,
      totalRoundPoints,
      scoreChange,
      newTotalScore,
      wasOnBarrel,
      fellOffBarrel,
      isDealer: player.id === round.dealer,
      sittingOut: isSittingOutDealer,
    };

    logDebug({
      gameId: game.id,
      playerId: player.id,
      eventType: 'scoring:player',
      eventData: {
        isBidder,
        finalBid,
        previousScore: currentScore.totalScore,
        ...playerResult,
      },
      result: 'success',
    });

    results.push(playerResult);
  }

  // Check if bidder made their bid
  const bidderResult = results.find(r => r.playerId === bidWinnerId)!;
  const bidderMadeBid = bidderResult.totalRoundPoints >= finalBid;

  return {
    bidderMadeBid,
    playerScores: results,
    winner: gameWinner,
  };
}

/**
 * Round number to nearest 10 (6+ rounds up)
 * e.g., 15 -> 20, 14 -> 10, 25 -> 30, 24 -> 20
 */
function roundToTen(points: number): number {
  const remainder = points % 10;
  if (remainder >= 6) {
    return points - remainder + 10;
  } else {
    return points - remainder;
  }
}

export function applyScores(game: GameState, scoreResult: RoundScoreResult): void {
  for (const result of scoreResult.playerScores) {
    const playerScore = game.scores[result.playerId];
    playerScore.totalScore = result.newTotalScore;
    playerScore.roundScores.push(result.scoreChange);
  }

  if (scoreResult.winner) {
    game.winner = scoreResult.winner;
  }
}

export function createRoundResult(
  game: GameState,
  scoreResult: RoundScoreResult
): RoundResult {
  const round = game.currentRound!;

  return {
    roundNumber: round.roundNumber,
    bidWinner: round.bidWinner!,
    bid: round.finalBid,
    bidderMadeBid: scoreResult.bidderMadeBid,
    playerResults: scoreResult.playerScores.map(s => ({
      playerId: s.playerId,
      trickPoints: s.trickPoints,
      marriagePoints: s.marriagePoints,
      totalRoundPoints: s.totalRoundPoints,
      scoreChange: s.scoreChange,
      newTotalScore: s.newTotalScore,
      wasOnBarrel: s.wasOnBarrel,
      fellOffBarrel: s.fellOffBarrel,
      isDealer: s.isDealer,
      sittingOut: s.sittingOut,
    })),
  };
}

export function getTotalPoints(): number {
  // Total points in deck (all card values)
  let total = 0;
  for (const points of Object.values(CARD_POINTS)) {
    total += points * 4; // 4 suits
  }
  return total; // Should be 120
}
