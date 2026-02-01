import type { GameState, GameAward, GameStatistics, Suit } from '@tysiac/shared';

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
}

// Round history for statistics calculation
export interface RoundHistory {
  roundNumber: number;
  bidWinner: string;
  bid: number;
  bidderMadeBid: boolean;
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

  // Select 3-4 best awards, prioritizing variety
  const selectedAwards = selectBestAwards(potentialAwards);

  // Calculate victory margin
  const scores = Object.values(game.scores).map(s => s.totalScore);
  scores.sort((a, b) => b - a);
  const victoryMargin = scores.length >= 2 ? scores[0] - scores[1] : 0;

  return {
    awards: selectedAwards,
    totalRounds: roundHistory.length,
    victoryMargin,
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

/**
 * Select the best 3-4 awards, prioritizing variety (different players)
 */
function selectBestAwards(awards: GameAward[]): GameAward[] {
  if (awards.length <= 3) return awards;

  // Priority order for award types
  const priorityOrder = [
    'consistent',      // Rare and impressive
    'perfectStorm',    // Big achievement
    'comebackKing',    // Dramatic
    'marriageCounselor', // Interesting
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
  };
}
