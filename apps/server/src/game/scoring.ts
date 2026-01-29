import type { GameState, PlayerScore, RoundResult, Suit } from '@tysiac/shared';
import { WINNING_SCORE, BARREL_THRESHOLD, MARRIAGE_VALUES, CARD_POINTS } from '@tysiac/shared';

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
  }[];
  winner: string | null;
}

/**
 * Calculate scores for a completed round.
 *
 * Rules:
 * - Bidder must hit EXACT bid to score; otherwise loses bid amount
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

    // Calculate trick points
    const trickPoints = playerState.pointsFromTricks;

    // Marriage points (only count for bidder or if declared by player)
    const marriagePoints = playerState.marriagePoints;

    // Total points earned this round
    const totalRoundPoints = trickPoints + marriagePoints;

    // Determine score change based on rules
    let scoreChange: number;
    const wasOnBarrel = currentScore.totalScore >= BARREL_THRESHOLD && currentScore.totalScore < WINNING_SCORE;

    if (isBidder) {
      // Bidder must hit exact bid
      if (totalRoundPoints >= finalBid) {
        scoreChange = finalBid; // Score exactly the bid amount
      } else {
        scoreChange = -finalBid; // Lose the bid amount
      }
    } else {
      // Non-bidder
      if (wasOnBarrel) {
        // On barrel: no points from defending
        scoreChange = 0;
      } else {
        // Round to nearest 10 (6+ rounds up)
        scoreChange = roundToTen(totalRoundPoints);
      }
    }

    // Calculate new total
    let newTotalScore = currentScore.totalScore + scoreChange;
    let fellOffBarrel = false;

    // Handle barrel rules
    if (isBidder && wasOnBarrel) {
      if (newTotalScore < WINNING_SCORE) {
        // Failed to reach 1000 while on barrel
        const newAttempts = currentScore.barrelAttempts + 1;

        if (newAttempts >= 3) {
          // Fall off barrel after 3 attempts
          newTotalScore = BARREL_THRESHOLD;
          fellOffBarrel = true;
          currentScore.barrelAttempts = 0;
        } else {
          // Stay on barrel, score doesn't change
          newTotalScore = currentScore.totalScore;
          currentScore.barrelAttempts = newAttempts;
        }
      } else {
        // Reached 1000, wins!
        currentScore.barrelAttempts = 0;
      }
    }

    // Check for win
    if (newTotalScore >= WINNING_SCORE && !gameWinner) {
      gameWinner = player.id;
    }

    // Update barrel status
    const isNowOnBarrel = newTotalScore >= BARREL_THRESHOLD && newTotalScore < WINNING_SCORE;
    currentScore.isOnBarrel = isNowOnBarrel;

    results.push({
      playerId: player.id,
      trickPoints,
      marriagePoints,
      totalRoundPoints,
      scoreChange,
      newTotalScore,
      wasOnBarrel,
      fellOffBarrel,
    });
  }

  // Check if bidder made their bid
  const bidderResult = results.find(r => r.playerId === bidWinnerId)!;
  const bidderMadeBid = bidderResult.scoreChange > 0;

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
