import { db, playerStats, players, gameScores } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';

interface PlayerStatsCache {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalBidsWon: number;
  totalBidsFailed: number;
  totalMarriages: number;
  highestGameScore: number;
  currentWinStreak: number;
  longestWinStreak: number;
  rating: number;
}

interface GameResult {
  playerId: string;
  finalScore: number;
  isWinner: boolean;
  bidsWon: number;
  bidsFailed: number;
  marriages: number;
}

interface EloInput {
  playerId: string;
  rating: number;
  gamesPlayed: number;
  finalScore: number;
  isWinner: boolean;
  bidsWon: number;
  bidsFailed: number;
  marriages: number;
}

// In-memory cache for registered player stats
const statsCache = new Map<string, PlayerStatsCache>();

function getKFactor(gamesPlayed: number): number {
  if (gamesPlayed < 30) return 40;
  if (gamesPlayed < 100) return 25;
  return 16;
}

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function calculatePerformanceMultiplier(result: EloInput, allResults: EloInput[]): number {
  const totalBids = result.bidsWon + result.bidsFailed;
  const bidSuccessBonus = totalBids > 0 ? (result.bidsWon / totalBids) * 0.2 : 0;
  const marriageBonus = Math.min(0.1, result.marriages * 0.025);

  let marginBonus = 0;
  if (result.isWinner) {
    const otherScores = allResults
      .filter(r => r.playerId !== result.playerId)
      .map(r => r.finalScore);
    const bestLoser = Math.max(...otherScores);
    const margin = result.finalScore - bestLoser;
    marginBonus = Math.min(0.3, margin / 1000);
  }

  return 1.0 + marginBonus + bidSuccessBonus + marriageBonus;
}

export function calculateEloChanges(inputs: EloInput[]): Map<string, number> {
  const changes = new Map<string, number>();

  for (const player of inputs) {
    const opponents = inputs.filter(p => p.playerId !== player.playerId);
    const K = getKFactor(player.gamesPlayed);

    let totalExpected = 0;
    let totalActual = 0;

    for (const opp of opponents) {
      totalExpected += expectedScore(player.rating, opp.rating);
      if (player.finalScore > opp.finalScore) {
        totalActual += 1.0;
      } else if (player.finalScore === opp.finalScore) {
        totalActual += 0.5;
      }
    }

    // Normalize over number of opponents
    totalExpected /= opponents.length;
    totalActual /= opponents.length;

    const baseChange = K * (totalActual - totalExpected);
    const multiplier = calculatePerformanceMultiplier(player, inputs);

    let finalChange: number;
    if (baseChange >= 0) {
      finalChange = baseChange * multiplier;
    } else {
      finalChange = baseChange / multiplier;
    }

    changes.set(player.playerId, Math.round(finalChange));
  }

  return changes;
}

export async function initializeStats(): Promise<void> {
  if (!db) {
    console.log('[Stats] No database, stats service using in-memory only');
    return;
  }

  try {
    const rows = await db.select().from(playerStats);
    for (const row of rows) {
      statsCache.set(row.playerId, {
        gamesPlayed: row.gamesPlayed,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
        totalBidsWon: row.totalBidsWon,
        totalBidsFailed: row.totalBidsFailed,
        totalMarriages: row.totalMarriages,
        highestGameScore: row.highestGameScore,
        currentWinStreak: row.currentWinStreak,
        longestWinStreak: row.longestWinStreak,
        rating: row.rating,
      });
    }
    console.log(`[Stats] Loaded stats for ${rows.length} registered players`);
  } catch (error) {
    console.error('[Stats] Failed to load stats:', error);
  }
}

export function getStats(playerId: string): PlayerStatsCache | null {
  return statsCache.get(playerId) || null;
}

export async function updateStatsAfterGame(
  gameId: string,
  roomId: string,
  results: GameResult[],
  roundScores: Record<string, number[]>
): Promise<void> {
  for (const result of results) {
    // Only track stats for registered users (Clerk user_* prefix)
    if (!result.playerId.startsWith('user_')) continue;

    let stats = statsCache.get(result.playerId);
    if (!stats) {
      stats = {
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
        totalBidsWon: 0, totalBidsFailed: 0, totalMarriages: 0,
        highestGameScore: 0, currentWinStreak: 0, longestWinStreak: 0,
        rating: 1000,
      };
    }

    stats.gamesPlayed++;
    stats.totalBidsWon += result.bidsWon;
    stats.totalBidsFailed += result.bidsFailed;
    stats.totalMarriages += result.marriages;

    if (result.finalScore > stats.highestGameScore) {
      stats.highestGameScore = result.finalScore;
    }

    if (result.isWinner) {
      stats.gamesWon++;
      stats.currentWinStreak++;
      if (stats.currentWinStreak > stats.longestWinStreak) {
        stats.longestWinStreak = stats.currentWinStreak;
      }
    } else {
      stats.gamesLost++;
      stats.currentWinStreak = 0;
    }

    statsCache.set(result.playerId, stats);
  }

  // Calculate Elo changes for all players (including AI for pairwise)
  const eloInputs: EloInput[] = results.map(result => {
    const isAI = result.playerId.startsWith('ai-');
    const cached = statsCache.get(result.playerId);
    return {
      playerId: result.playerId,
      rating: isAI ? 1000 : (cached?.rating ?? 1000),
      gamesPlayed: isAI ? 100 : (cached?.gamesPlayed ?? 0),
      finalScore: result.finalScore,
      isWinner: result.isWinner,
      bidsWon: result.bidsWon,
      bidsFailed: result.bidsFailed,
      marriages: result.marriages,
    };
  });

  const eloChanges = calculateEloChanges(eloInputs);

  // Apply Elo changes only to registered (Clerk) users
  for (const result of results) {
    if (!result.playerId.startsWith('user_')) continue;
    const stats = statsCache.get(result.playerId);
    if (!stats) continue;

    const change = eloChanges.get(result.playerId) ?? 0;
    stats.rating = Math.max(100, stats.rating + change);
    statsCache.set(result.playerId, stats);

    // Persist to database (fire-and-forget)
    if (db) {
      db.update(playerStats)
        .set({
          gamesPlayed: stats.gamesPlayed,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          totalBidsWon: stats.totalBidsWon,
          totalBidsFailed: stats.totalBidsFailed,
          totalMarriages: stats.totalMarriages,
          highestGameScore: stats.highestGameScore,
          currentWinStreak: stats.currentWinStreak,
          longestWinStreak: stats.longestWinStreak,
          rating: stats.rating,
          updatedAt: new Date(),
        })
        .where(eq(playerStats.playerId, result.playerId))
        .catch((error) => {
          console.error(`[Stats] Failed to persist stats for ${result.playerId}:`, error);
        });
    }
  }

  // Persist game scores to DB (fire-and-forget)
  if (db) {
    for (const result of results) {
      const playerRoundScores = roundScores[result.playerId] || [];
      db.insert(gameScores).values({
        gameId,
        playerId: result.playerId,
        finalScore: result.finalScore,
        roundScores: playerRoundScores,
        isWinner: result.isWinner,
      }).onConflictDoNothing()
        .catch((error) => {
          console.error(`[Stats] Failed to persist game score for ${result.playerId}:`, error);
        });
    }
  }
}

/**
 * Ensure a Clerk user has a player + playerStats row in the database.
 * Called fire-and-forget on socket connection for authenticated users.
 */
export async function ensureClerkPlayer(clerkUserId: string): Promise<void> {
  if (!db) return;

  try {
    // Check if player already exists
    const existing = await db.select({ id: players.id })
      .from(players)
      .where(eq(players.clerkId, clerkUserId))
      .limit(1);

    if (existing.length > 0) return;

    // Create player row (use clerkUserId as the player ID for consistency)
    const now = new Date();
    await db.insert(players).values({
      id: clerkUserId,
      name: clerkUserId, // Will be overridden by display name from client
      clerkId: clerkUserId,
      isRegistered: true,
      createdAt: now,
      lastSeen: now,
    }).onConflictDoNothing();

    // Create empty stats row
    await db.insert(playerStats).values({
      playerId: clerkUserId,
      updatedAt: now,
    }).onConflictDoNothing();

    console.log(`[Stats] Created player + stats for Clerk user ${clerkUserId}`);
  } catch (error) {
    console.error(`[Stats] Failed to ensure Clerk player ${clerkUserId}:`, error);
  }
}
