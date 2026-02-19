import type { GameState, GameAward, GameStatistics, Suit, DetailedPlayerStats, RoundByRoundData, WhatIfScenario } from '@tysiac/shared';

// Player statistics tracked during the game
export interface PlayerGameStats {
  totalBidAmount: number;
  bidCount: number;
  marriageCount: number;
  failedBidCount: number;
  successfulBidCount: number;
  roundsOnBarrel: number;
  minScore: number;
  maxScore: number;
  highestRoundPoints: number;
  reachedGrunwald: boolean;
  grunwaldRound: number | null;
  totalTricksWon: number;
  highestSingleBid: number;
  lowBidWins: number;
  hadCleanSweep: boolean;
  cleanSweepRound: number | null;
}

// Round history for statistics calculation
export interface RoundHistory {
  roundNumber: number;
  bidWinner: string;
  bid: number;
  bidderMadeBid: boolean;
  wasPassed?: boolean;
  playerScores: Record<string, {
    trickPoints: number;
    marriagePoints: number;
    totalRoundPoints: number;
    scoreChange: number;
    newTotalScore: number;
    wasOnBarrel: boolean;
  }>;
}

// Award definitions
const AWARDS = {
  gambler: {
    id: 'gambler',
    titleEn: 'The Gambler',
    titlePl: 'Hazardzista',
    emoji: '🎲',
  },
  marriageCounselor: {
    id: 'marriageCounselor',
    titleEn: 'Marriage Counselor',
    titlePl: 'Swat',
    emoji: '💍',
  },
  riskyBusiness: {
    id: 'riskyBusiness',
    titleEn: 'Risky Business',
    titlePl: 'Ryzykant',
    emoji: '📉',
  },
  consistent: {
    id: 'consistent',
    titleEn: 'Mr. Consistent',
    titlePl: 'Niezawodny',
    emoji: '🎯',
  },
  barrelRider: {
    id: 'barrelRider',
    titleEn: 'Barrel Rider',
    titlePl: 'Beczkowicz',
    emoji: '🛢️',
  },
  comebackKing: {
    id: 'comebackKing',
    titleEn: 'Comeback King',
    titlePl: 'Feniks',
    emoji: '🔥',
  },
  perfectStorm: {
    id: 'perfectStorm',
    titleEn: 'Perfect Storm',
    titlePl: 'Burza',
    emoji: '⚡',
  },
  grunwald: {
    id: 'grunwald',
    titleEn: 'Battle of Grunwald',
    titlePl: 'Grunwald',
    emoji: '🏰',
  },
  cardShark: {
    id: 'cardShark',
    titleEn: 'Card Shark',
    titlePl: 'Rekin Kart',
    emoji: '🦈',
  },
  overbidder: {
    id: 'overbidder',
    titleEn: 'Overbidder',
    titlePl: 'Licytator',
    emoji: '📈',
  },
  lowRoller: {
    id: 'lowRoller',
    titleEn: 'Low Roller',
    titlePl: 'Skromny Gracz',
    emoji: '🎱',
  },
  cleanSweep: {
    id: 'cleanSweep',
    titleEn: 'Clean Sweep',
    titlePl: 'Czyste Konto',
    emoji: '🧹',
  },
  underdog: {
    id: 'underdog',
    titleEn: 'Underdog',
    titlePl: 'Czarny Koń',
    emoji: '🐕',
  },
} as const;

/**
 * Calculate game statistics and awards at the end of a game
 */
export function calculateGameStatistics(
  game: GameState,
  roundHistory: RoundHistory[],
  playerStats: Map<string, PlayerGameStats>
): GameStatistics {
  const playerNames = new Map<string, string>();
  for (const player of game.players) {
    playerNames.set(player.id, player.name);
  }

  const potentialAwards: GameAward[] = [];

  // 1. The Gambler - Most aggressive bidder (highest total bids)
  const gamblerAward = calculateGamblerAward(playerStats, playerNames);
  if (gamblerAward) potentialAwards.push(gamblerAward);

  // 2. Marriage Counselor - Most marriages declared
  const marriageAward = calculateMarriageAward(playerStats, playerNames);
  if (marriageAward) potentialAwards.push(marriageAward);

  // 3. Risky Business - Most failed bids (min 2)
  const riskyAward = calculateRiskyAward(playerStats, playerNames);
  if (riskyAward) potentialAwards.push(riskyAward);

  // 4. Mr. Consistent - Never failed a bid (min 2 bids)
  const consistentAward = calculateConsistentAward(playerStats, playerNames);
  if (consistentAward) potentialAwards.push(consistentAward);

  // 5. Barrel Rider - Most rounds spent on barrel
  const barrelAward = calculateBarrelAward(playerStats, playerNames);
  if (barrelAward) potentialAwards.push(barrelAward);

  // 6. Comeback King - Largest recovery from negative score
  const comebackAward = calculateComebackAward(playerStats, playerNames);
  if (comebackAward) potentialAwards.push(comebackAward);

  // 7. Perfect Storm - Won a round with 150+ total points
  const perfectStormAward = calculatePerfectStormAward(playerStats, playerNames);
  if (perfectStormAward) potentialAwards.push(perfectStormAward);

  // 8. Grunwald - Reached exactly 410 points
  const grunwaldAward = calculateGrunwaldAward(playerStats, playerNames);
  if (grunwaldAward) potentialAwards.push(grunwaldAward);

  // 9. Card Shark - Most tricks won across all rounds
  const cardSharkAward = calculateCardSharkAward(playerStats, playerNames);
  if (cardSharkAward) potentialAwards.push(cardSharkAward);

  // 10. Overbidder - Placed the highest single bid
  const overbidderAward = calculateOverbidderAward(playerStats, playerNames);
  if (overbidderAward) potentialAwards.push(overbidderAward);

  // 11. Low Roller - Won the most rounds bidding exactly 100
  const lowRollerAward = calculateLowRollerAward(playerStats, playerNames);
  if (lowRollerAward) potentialAwards.push(lowRollerAward);

  // 12. Clean Sweep - Won all tricks in a round (120 trick pts)
  const cleanSweepAward = calculateCleanSweepAward(playerStats, playerNames);
  if (cleanSweepAward) potentialAwards.push(cleanSweepAward);

  // 13. Underdog - Was in last place but finished 2nd or better
  const underdogAward = calculateUnderdogAward(roundHistory, playerNames, game);
  if (underdogAward) potentialAwards.push(underdogAward);

  // Select 3-4 best awards, prioritizing variety
  const selectedAwards = selectBestAwards(potentialAwards);

  // Calculate victory margin
  const scores = Object.values(game.scores).map(s => s.totalScore);
  scores.sort((a, b) => b - a);
  const victoryMargin = scores.length >= 2 ? scores[0] - scores[1] : 0;

  // Calculate detailed player stats
  const playerDetails = calculateDetailedStats(game, playerStats, playerNames);

  // Calculate round-by-round scores for graphing
  const roundByRound = calculateRoundByRound(roundHistory, game.players.map(p => p.id));

  // Generate close calls
  const closeCalls = generateCloseCalls(game, playerNames);

  // Generate what-if scenarios
  const whatIf = generateWhatIfScenarios(roundHistory, playerNames, game);

  return {
    awards: selectedAwards,
    totalRounds: roundHistory.length,
    victoryMargin,
    playerDetails,
    roundByRound,
    closeCalls,
    whatIf,
  };
}

function calculateGamblerAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxBids = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.totalBidAmount > maxBids) {
      maxBids = stats.totalBidAmount;
      winnerId = playerId;
    }
  }

  if (!winnerId || maxBids === 0) return null;

  return {
    ...AWARDS.gambler,
    playerId: winnerId,
    value: maxBids,
    description: `Total bids: ${maxBids}`,
  };
}

function calculateMarriageAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxMarriages = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.marriageCount > maxMarriages) {
      maxMarriages = stats.marriageCount;
      winnerId = playerId;
    }
  }

  if (!winnerId || maxMarriages < 1) return null;

  return {
    ...AWARDS.marriageCounselor,
    playerId: winnerId,
    value: maxMarriages,
    description: `${maxMarriages} marriage${maxMarriages > 1 ? 's' : ''} declared`,
  };
}

function calculateRiskyAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxFailed = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.failedBidCount > maxFailed && stats.failedBidCount >= 2) {
      maxFailed = stats.failedBidCount;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.riskyBusiness,
    playerId: winnerId,
    value: maxFailed,
    description: `${maxFailed} failed bid${maxFailed > 1 ? 's' : ''}`,
  };
}

function calculateConsistentAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let winnerId = '';
  let bestBidCount = 0;

  for (const [playerId, stats] of playerStats) {
    // Must have at least 2 bids and no failures
    if (stats.bidCount >= 2 && stats.failedBidCount === 0 && stats.bidCount > bestBidCount) {
      bestBidCount = stats.bidCount;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.consistent,
    playerId: winnerId,
    value: bestBidCount,
    description: `${bestBidCount} successful bids in a row`,
  };
}

function calculateBarrelAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxBarrelRounds = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.roundsOnBarrel > maxBarrelRounds && stats.roundsOnBarrel >= 2) {
      maxBarrelRounds = stats.roundsOnBarrel;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.barrelRider,
    playerId: winnerId,
    value: maxBarrelRounds,
    description: `${maxBarrelRounds} rounds on the barrel`,
  };
}

function calculateComebackAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxComeback = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    // Comeback = went from negative to positive (or just had big recovery)
    const recovery = stats.maxScore - stats.minScore;
    // Only count if they actually had negative score
    if (stats.minScore < 0 && recovery > maxComeback && recovery >= 200) {
      maxComeback = recovery;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.comebackKing,
    playerId: winnerId,
    value: maxComeback,
    description: `Recovered ${maxComeback} points`,
  };
}

function calculatePerfectStormAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxPoints = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.highestRoundPoints >= 150 && stats.highestRoundPoints > maxPoints) {
      maxPoints = stats.highestRoundPoints;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.perfectStorm,
    playerId: winnerId,
    value: maxPoints,
    description: `${maxPoints} points in one round`,
  };
}

function calculateGrunwaldAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let winnerId = '';
  let earliestRound = Infinity;

  for (const [playerId, stats] of playerStats) {
    if (stats.reachedGrunwald && stats.grunwaldRound !== null && stats.grunwaldRound < earliestRound) {
      earliestRound = stats.grunwaldRound;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.grunwald,
    playerId: winnerId,
    value: 410,
    description: `Reached 410 points in round ${earliestRound}`,
  };
}

function calculateCardSharkAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxTricks = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.totalTricksWon > maxTricks) {
      maxTricks = stats.totalTricksWon;
      winnerId = playerId;
    }
  }

  if (!winnerId || maxTricks < 5) return null;

  return {
    ...AWARDS.cardShark,
    playerId: winnerId,
    value: maxTricks,
    description: `Won ${maxTricks} tricks total`,
  };
}

function calculateOverbidderAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxBid = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.highestSingleBid > maxBid && stats.highestSingleBid >= 120) {
      maxBid = stats.highestSingleBid;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.overbidder,
    playerId: winnerId,
    value: maxBid,
    description: `Highest bid: ${maxBid}`,
  };
}

function calculateLowRollerAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let maxLowWins = 0;
  let winnerId = '';

  for (const [playerId, stats] of playerStats) {
    if (stats.lowBidWins > maxLowWins && stats.lowBidWins >= 2) {
      maxLowWins = stats.lowBidWins;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.lowRoller,
    playerId: winnerId,
    value: maxLowWins,
    description: `Won ${maxLowWins} rounds at 100 bid`,
  };
}

function calculateCleanSweepAward(
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): GameAward | null {
  let winnerId = '';
  let earliestRound = Infinity;

  for (const [playerId, stats] of playerStats) {
    if (stats.hadCleanSweep && stats.cleanSweepRound !== null && stats.cleanSweepRound < earliestRound) {
      earliestRound = stats.cleanSweepRound;
      winnerId = playerId;
    }
  }

  if (!winnerId) return null;

  return {
    ...AWARDS.cleanSweep,
    playerId: winnerId,
    value: 120,
    description: `Won all tricks in round ${earliestRound}`,
  };
}

function calculateUnderdogAward(
  roundHistory: RoundHistory[],
  playerNames: Map<string, string>,
  game: GameState
): GameAward | null {
  if (roundHistory.length < 3) return null;

  const playerIds = Object.keys(roundHistory[0].playerScores);

  // Check each player: were they ever in last place?
  for (const playerId of playerIds) {
    let wasInLastPlace = false;

    // Check round-by-round scores for when this player was in last place
    for (const round of roundHistory) {
      const scores = Object.entries(round.playerScores)
        .map(([pid, s]) => ({ pid, score: s.newTotalScore }));
      scores.sort((a, b) => a.score - b.score);
      if (scores[0].pid === playerId && scores[0].score < scores[1].score) {
        wasInLastPlace = true;
        break;
      }
    }

    if (!wasInLastPlace) continue;

    // Check final standings: did they finish 2nd or better?
    const finalScores = Object.entries(game.scores)
      .map(([pid, s]) => ({ pid, score: s.totalScore }));
    finalScores.sort((a, b) => b.score - a.score);
    const finalRank = finalScores.findIndex(s => s.pid === playerId);

    if (finalRank <= 1) { // 0 = 1st, 1 = 2nd
      const rankLabel = finalRank === 0 ? '1st' : '2nd';
      return {
        ...AWARDS.underdog,
        playerId,
        value: finalScores[finalRank].score,
        description: `Was last, finished ${rankLabel}!`,
      };
    }
  }

  return null;
}

/**
 * Select the best 3-4 awards, prioritizing variety (different players)
 */
function selectBestAwards(awards: GameAward[]): GameAward[] {
  if (awards.length <= 3) return awards;

  // Priority order for award types
  const priorityOrder = [
    'cleanSweep',      // Extremely rare
    'consistent',      // Rare and impressive
    'perfectStorm',    // Big achievement
    'grunwald',        // Rare milestone
    'underdog',        // Dramatic comeback
    'comebackKing',    // Dramatic
    'overbidder',      // Bold play
    'marriageCounselor', // Interesting
    'cardShark',       // Fun stat
    'lowRoller',       // Fun strategy
    'barrelRider',     // Fun
    'riskyBusiness',   // Entertaining
    'gambler',         // Common fallback
  ];

  // Sort by priority
  const sortedAwards = [...awards].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a.id);
    const bPriority = priorityOrder.indexOf(b.id);
    return aPriority - bPriority;
  });

  const selected: GameAward[] = [];
  const playersWithAwards = new Set<string>();

  // First pass: add awards prioritizing different players
  for (const award of sortedAwards) {
    if (selected.length >= 4) break;

    // Prefer awards for players who don't have one yet
    if (!playersWithAwards.has(award.playerId)) {
      selected.push(award);
      playersWithAwards.add(award.playerId);
    }
  }

  // Second pass: fill remaining slots with any high-priority awards
  for (const award of sortedAwards) {
    if (selected.length >= 4) break;
    if (!selected.includes(award)) {
      selected.push(award);
    }
  }

  return selected.slice(0, 4);
}

/**
 * Create initial player stats
 */
export function createInitialPlayerStats(): PlayerGameStats {
  return {
    totalBidAmount: 0,
    bidCount: 0,
    marriageCount: 0,
    failedBidCount: 0,
    successfulBidCount: 0,
    roundsOnBarrel: 0,
    minScore: 0,
    maxScore: 0,
    highestRoundPoints: 0,
    reachedGrunwald: false,
    grunwaldRound: null,
    totalTricksWon: 0,
    highestSingleBid: 0,
    lowBidWins: 0,
    hadCleanSweep: false,
    cleanSweepRound: null,
  };
}

/**
 * Calculate detailed per-player statistics
 */
function calculateDetailedStats(
  game: GameState,
  playerStats: Map<string, PlayerGameStats>,
  playerNames: Map<string, string>
): DetailedPlayerStats[] {
  const details: DetailedPlayerStats[] = [];

  for (const [playerId, stats] of playerStats) {
    const totalBids = stats.successfulBidCount + stats.failedBidCount;
    const bidSuccessRate = totalBids > 0
      ? Math.round((stats.successfulBidCount / totalBids) * 100)
      : 0;

    const avgBidAmount = stats.bidCount > 0
      ? Math.round(stats.totalBidAmount / stats.bidCount)
      : 0;

    details.push({
      playerId,
      bidSuccessRate,
      totalBidsWon: stats.successfulBidCount,
      totalBidsFailed: stats.failedBidCount,
      avgBidAmount,
      totalMarriages: stats.marriageCount,
      highestSingleRound: stats.highestRoundPoints,
      lowestScore: stats.minScore,
      highestScore: stats.maxScore,
    });
  }

  return details;
}

/**
 * Calculate round-by-round score progression
 */
function calculateRoundByRound(
  roundHistory: RoundHistory[],
  playerIds: string[]
): RoundByRoundData[] {
  const data: RoundByRoundData[] = [];

  // Start with round 0 (all at 0)
  const currentScores: Record<string, number> = {};
  for (const playerId of playerIds) {
    currentScores[playerId] = 0;
  }
  data.push({ roundNumber: 0, scores: { ...currentScores } });

  // Track scores through each round
  for (const round of roundHistory) {
    for (const [playerId, scoreData] of Object.entries(round.playerScores)) {
      currentScores[playerId] = scoreData.newTotalScore;
    }
    data.push({
      roundNumber: round.roundNumber,
      scores: { ...currentScores },
    });
  }

  return data;
}

/**
 * Generate "close calls" - situations where the game could have gone differently
 */
function generateCloseCalls(
  game: GameState,
  playerNames: Map<string, string>
): string[] {
  const calls: string[] = [];
  const winnerId = game.winner;
  const winningScore = game.scores[winnerId!]?.totalScore || 1000;

  for (const [playerId, score] of Object.entries(game.scores)) {
    if (playerId === winnerId) continue;

    const playerName = playerNames.get(playerId) || 'Unknown';
    const difference = winningScore - score.totalScore;

    if (difference <= 50) {
      calls.push(`${playerName} was only ${difference} points away from winning!`);
    } else if (difference <= 100) {
      calls.push(`${playerName} finished ${difference} points behind the winner.`);
    }

    // Check if they were ever in the lead
    if (score.totalScore >= 800) {
      calls.push(`${playerName} reached the barrel at ${score.totalScore > 880 ? 'a dangerous' : ''} ${Math.max(...score.roundScores.map((_, i, arr) => arr.slice(0, i + 1).reduce((a, b) => a + b, 0)).filter(s => s >= 800))} points.`);
    }
  }

  return calls.slice(0, 3); // Limit to 3 close calls
}

/**
 * Generate fun what-if scenarios
 */
function generateWhatIfScenarios(
  roundHistory: RoundHistory[],
  playerNames: Map<string, string>,
  game: GameState
): WhatIfScenario[] {
  const scenarios: WhatIfScenario[] = [];

  // Find rounds where bidder failed (exclude passed rounds)
  const failedBids = roundHistory.filter(r => !r.bidderMadeBid && !r.wasPassed);

  if (failedBids.length > 0) {
    const lastFailed = failedBids[failedBids.length - 1];
    const bidderName = playerNames.get(lastFailed.bidWinner) || 'Unknown';
    scenarios.push({
      description: `If ${bidderName} had made their ${lastFailed.bid} bid in round ${lastFailed.roundNumber}...`,
      hypotheticalOutcome: `They would have gained ${lastFailed.bid} points instead of losing it!`,
    });
  }

  // Look for rounds with high bids
  const highBids = roundHistory.filter(r => r.bid >= 150);
  if (highBids.length > 0) {
    const highestBid = highBids.reduce((max, r) => r.bid > max.bid ? r : max);
    const bidderName = playerNames.get(highestBid.bidWinner) || 'Unknown';
    scenarios.push({
      description: `${bidderName}'s bold ${highestBid.bid} bid in round ${highestBid.roundNumber}`,
      hypotheticalOutcome: highestBid.bidderMadeBid
        ? 'paid off spectacularly!'
        : 'was a brave gamble that didn\'t work out.',
    });
  }

  // Check if winner barely made it
  const winner = game.winner;
  if (winner && game.scores[winner]) {
    const winnerScore = game.scores[winner].totalScore;
    if (winnerScore >= 1000 && winnerScore < 1050) {
      scenarios.push({
        description: 'A nail-biter finish!',
        hypotheticalOutcome: `The winner crossed 1000 with just ${winnerScore - 1000} points to spare.`,
      });
    }
  }

  return scenarios.slice(0, 3); // Limit to 3 scenarios
}
