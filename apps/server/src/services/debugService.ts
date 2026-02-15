import { nanoid } from 'nanoid';
import { db, debugLogs } from '../db/index.js';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import type { GameState } from '@tysiac/shared';

// In-memory buffer for when database is not available
// Also serves as a fast write buffer that gets flushed to DB periodically
interface DebugLogEntry {
  id: string;
  gameId: string | null;
  roomId: string | null;
  sessionId: string | null;
  playerId: string | null;
  socketId: string | null;
  eventType: string;
  eventData: unknown;
  gameState: unknown;
  result: string | null;
  errorMessage: string | null;
  metadata: unknown;
  timestamp: Date;
}

// O(1) circular buffer — avoids shift() GC pressure on large arrays
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0; // next write position
  private count = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Return all items oldest-first */
  toArray(): T[] {
    if (this.count === 0) return [];
    const result: T[] = new Array(this.count);
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buffer[(start + i) % this.capacity] as T;
    }
    return result;
  }

  get length(): number {
    return this.count;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }
}

const MAX_IN_MEMORY_LOGS = 2000;
const FLUSH_INTERVAL = 5000; // Flush to DB every 5 seconds
const MAX_GAMES_TO_KEEP = 10; // Keep logs for last 10 games only
const MAX_PENDING_WRITES = 500; // Cap pending writes to prevent unbounded growth

const logBuffer = new CircularBuffer<DebugLogEntry>(MAX_IN_MEMORY_LOGS);

let flushTimer: NodeJS.Timeout | null = null;
let pendingWrites: DebugLogEntry[] = [];

/** Get a snapshot of in-memory logs (oldest first) */
function getInMemoryLogs(): DebugLogEntry[] {
  return logBuffer.toArray();
}

// Generate a session ID for grouping logs before a game is created
export function generateSessionId(): string {
  return `session-${nanoid(10)}`;
}

// Log a debug entry
export function logDebug(params: {
  gameId?: string | null;
  roomId?: string | null;
  sessionId?: string | null;
  playerId?: string | null;
  socketId?: string | null;
  eventType: string;
  eventData?: unknown;
  gameState?: Partial<GameState> | null;
  result?: 'success' | 'error' | 'rejected';
  errorMessage?: string | null;
  metadata?: unknown;
}): void {
  const entry: DebugLogEntry = {
    id: nanoid(),
    gameId: params.gameId ?? null,
    roomId: params.roomId ?? null,
    sessionId: params.sessionId ?? null,
    playerId: params.playerId ?? null,
    socketId: params.socketId ?? null,
    eventType: params.eventType,
    eventData: params.eventData ?? null,
    gameState: sanitizeGameState(params.gameState),
    result: params.result ?? null,
    errorMessage: params.errorMessage ?? null,
    metadata: params.metadata ?? null,
    timestamp: new Date(),
  };

  // Also log to console for immediate visibility
  const logPrefix = `[${params.eventType}]`;
  const logData = {
    gameId: params.gameId,
    playerId: params.playerId,
    ...(params.eventData as object || {}),
    ...(params.result ? { result: params.result } : {}),
    ...(params.errorMessage ? { error: params.errorMessage } : {}),
  };
  console.log(logPrefix, JSON.stringify(logData));

  // Add to circular buffer (O(1), no shift)
  logBuffer.push(entry);

  // Add to pending writes for database (with cap)
  if (db) {
    pendingWrites.push(entry);
    if (pendingWrites.length > MAX_PENDING_WRITES) {
      // Drop oldest pending writes to prevent unbounded memory growth
      const excess = pendingWrites.length - MAX_PENDING_WRITES;
      pendingWrites = pendingWrites.slice(excess);
      console.warn(`[DebugService] Dropped ${excess} oldest pending writes (cap: ${MAX_PENDING_WRITES})`);
    }
    scheduleFlush();
  }
}

// Sanitize game state to remove sensitive/large data
function sanitizeGameState(gameState: Partial<GameState> | null | undefined): unknown {
  if (!gameState) return null;

  // Create a summary of the game state for debugging
  return {
    id: gameState.id,
    phase: gameState.phase,
    roundNumber: gameState.currentRound?.roundNumber,
    dealer: gameState.currentRound?.dealer,
    bidWinner: gameState.currentRound?.bidWinner,
    finalBid: gameState.currentRound?.finalBid,
    trumpSuit: gameState.currentRound?.trumpSuit,
    currentTrick: gameState.currentRound?.currentTrick ? {
      leadSuit: gameState.currentRound.currentTrick.leadSuit,
      currentPlayer: gameState.currentRound.currentTrick.currentPlayer,
      cardsPlayed: gameState.currentRound.currentTrick.cards?.length ?? 0,
      trickNumber: gameState.currentRound.currentTrick.trickNumber,
    } : null,
    completedTricks: gameState.currentRound?.completedTricks,
    scores: gameState.scores ? Object.fromEntries(
      Object.entries(gameState.scores).map(([pid, score]) => [
        pid,
        { total: score.totalScore, onBarrel: score.isOnBarrel },
      ])
    ) : null,
  };
}

// Schedule a flush to the database
function scheduleFlush(): void {
  if (flushTimer) return;

  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushToDatabase();
  }, FLUSH_INTERVAL);
}

// Flush pending writes to the database
async function flushToDatabase(): Promise<void> {
  if (!db || pendingWrites.length === 0) return;

  const toWrite = [...pendingWrites];
  pendingWrites = [];

  try {
    await db.insert(debugLogs).values(toWrite);
  } catch (error) {
    console.error('[DebugService] Failed to flush logs to database:', error);
    // Re-add failed writes, but respect the cap
    pendingWrites = [...toWrite, ...pendingWrites];
    if (pendingWrites.length > MAX_PENDING_WRITES) {
      pendingWrites = pendingWrites.slice(pendingWrites.length - MAX_PENDING_WRITES);
    }
  }
}

// Force flush (call on shutdown)
export async function forceFlush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushToDatabase();
}

// Query logs for a specific game
export async function getLogsByGameId(gameId: string): Promise<DebugLogEntry[]> {
  // Check in-memory first
  const memoryLogs = getInMemoryLogs().filter(log => log.gameId === gameId);

  if (!db) {
    return memoryLogs;
  }

  // Flush pending writes first to ensure we have latest data
  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .where(eq(debugLogs.gameId, gameId))
      .orderBy(desc(debugLogs.timestamp));

    // Merge and dedupe (prefer DB version)
    const dbLogIds = new Set(dbLogs.map(l => l.id));
    const uniqueMemoryLogs = memoryLogs.filter(l => !dbLogIds.has(l.id));

    return [...dbLogs as DebugLogEntry[], ...uniqueMemoryLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('[DebugService] Failed to query logs:', error);
    return memoryLogs;
  }
}

// Query logs for a specific session
export async function getLogsBySessionId(sessionId: string): Promise<DebugLogEntry[]> {
  const memoryLogs = getInMemoryLogs().filter(log => log.sessionId === sessionId);

  if (!db) {
    return memoryLogs;
  }

  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .where(eq(debugLogs.sessionId, sessionId))
      .orderBy(desc(debugLogs.timestamp));

    const dbLogIds = new Set(dbLogs.map(l => l.id));
    const uniqueMemoryLogs = memoryLogs.filter(l => !dbLogIds.has(l.id));

    return [...dbLogs as DebugLogEntry[], ...uniqueMemoryLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('[DebugService] Failed to query logs:', error);
    return memoryLogs;
  }
}

// Query logs for a specific room
export async function getLogsByRoomId(roomId: string): Promise<DebugLogEntry[]> {
  const memoryLogs = getInMemoryLogs().filter(log => log.roomId === roomId);

  if (!db) {
    return memoryLogs;
  }

  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .where(eq(debugLogs.roomId, roomId))
      .orderBy(desc(debugLogs.timestamp));

    const dbLogIds = new Set(dbLogs.map(l => l.id));
    const uniqueMemoryLogs = memoryLogs.filter(l => !dbLogIds.has(l.id));

    return [...dbLogs as DebugLogEntry[], ...uniqueMemoryLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error('[DebugService] Failed to query logs:', error);
    return memoryLogs;
  }
}

// Query recent logs (for debugging)
export async function getRecentLogs(limit: number = 100): Promise<DebugLogEntry[]> {
  const allMemory = getInMemoryLogs();
  const memoryLogs = allMemory.slice(-limit);

  if (!db) {
    return memoryLogs;
  }

  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .orderBy(desc(debugLogs.timestamp))
      .limit(limit);

    return dbLogs as DebugLogEntry[];
  } catch (error) {
    console.error('[DebugService] Failed to query recent logs:', error);
    return memoryLogs;
  }
}

// Search logs by event type
export async function getLogsByEventType(eventType: string, limit: number = 100): Promise<DebugLogEntry[]> {
  const memoryLogs = getInMemoryLogs()
    .filter(log => log.eventType === eventType)
    .slice(-limit);

  if (!db) {
    return memoryLogs;
  }

  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .where(eq(debugLogs.eventType, eventType))
      .orderBy(desc(debugLogs.timestamp))
      .limit(limit);

    return dbLogs as DebugLogEntry[];
  } catch (error) {
    console.error('[DebugService] Failed to query logs by event type:', error);
    return memoryLogs;
  }
}

// Search logs by error
export async function getErrorLogs(limit: number = 100): Promise<DebugLogEntry[]> {
  const memoryLogs = getInMemoryLogs()
    .filter(log => log.result === 'error' || log.result === 'rejected')
    .slice(-limit);

  if (!db) {
    return memoryLogs;
  }

  await flushToDatabase();

  try {
    const dbLogs = await db
      .select()
      .from(debugLogs)
      .where(inArray(debugLogs.result, ['error', 'rejected']))
      .orderBy(desc(debugLogs.timestamp))
      .limit(limit);

    return dbLogs as DebugLogEntry[];
  } catch (error) {
    console.error('[DebugService] Failed to query error logs:', error);
    return memoryLogs;
  }
}

// Get summary of recent games for quick lookup
export async function getRecentGamesSummary(): Promise<Array<{
  gameId: string;
  roomId: string | null;
  startTime: Date;
  endTime: Date | null;
  actionCount: number;
  errorCount: number;
}>> {
  if (!db) {
    // In-memory summary
    const gameMap = new Map<string, {
      roomId: string | null;
      startTime: Date;
      endTime: Date | null;
      actionCount: number;
      errorCount: number;
    }>();

    for (const log of getInMemoryLogs()) {
      if (!log.gameId) continue;

      const existing = gameMap.get(log.gameId);
      if (!existing) {
        gameMap.set(log.gameId, {
          roomId: log.roomId,
          startTime: log.timestamp,
          endTime: log.timestamp,
          actionCount: 1,
          errorCount: log.result === 'error' || log.result === 'rejected' ? 1 : 0,
        });
      } else {
        existing.endTime = log.timestamp;
        existing.actionCount++;
        if (log.result === 'error' || log.result === 'rejected') {
          existing.errorCount++;
        }
      }
    }

    return Array.from(gameMap.entries())
      .map(([gameId, data]) => ({ gameId, ...data }))
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, MAX_GAMES_TO_KEEP);
  }

  await flushToDatabase();

  try {
    const result = await db
      .select({
        gameId: debugLogs.gameId,
        roomId: sql<string>`MAX(${debugLogs.roomId})`,
        startTime: sql<Date>`MIN(${debugLogs.timestamp})`,
        endTime: sql<Date>`MAX(${debugLogs.timestamp})`,
        actionCount: sql<number>`COUNT(*)`,
        errorCount: sql<number>`SUM(CASE WHEN ${debugLogs.result} IN ('error', 'rejected') THEN 1 ELSE 0 END)`,
      })
      .from(debugLogs)
      .where(sql`${debugLogs.gameId} IS NOT NULL`)
      .groupBy(debugLogs.gameId)
      .orderBy(sql`MIN(${debugLogs.timestamp}) DESC`)
      .limit(MAX_GAMES_TO_KEEP);

    return result.map(r => ({
      gameId: r.gameId!,
      roomId: r.roomId,
      startTime: r.startTime,
      endTime: r.endTime,
      actionCount: Number(r.actionCount),
      errorCount: Number(r.errorCount),
    }));
  } catch (error) {
    console.error('[DebugService] Failed to get games summary:', error);
    return [];
  }
}

// Cleanup old logs (keep only last N games)
export async function cleanupOldLogs(): Promise<number> {
  if (!db) {
    // Rebuild circular buffer keeping only logs for recent games
    const allLogs = getInMemoryLogs();
    const gameTimestamps = new Map<string, Date>();

    for (const log of allLogs) {
      if (log.gameId) {
        const existing = gameTimestamps.get(log.gameId);
        if (!existing || log.timestamp > existing) {
          gameTimestamps.set(log.gameId, log.timestamp);
        }
      }
    }

    const sortedGames = Array.from(gameTimestamps.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime());

    const gamesToKeep = new Set(sortedGames.slice(0, MAX_GAMES_TO_KEEP).map(g => g[0]));

    const beforeCount = allLogs.length;
    const kept = allLogs.filter(log => !log.gameId || gamesToKeep.has(log.gameId));

    // Rebuild circular buffer with kept logs
    logBuffer.clear();
    for (const log of kept) {
      logBuffer.push(log);
    }

    return beforeCount - kept.length;
  }

  try {
    // Get the 10 most recent game IDs
    const recentGames = await db
      .select({ gameId: debugLogs.gameId })
      .from(debugLogs)
      .where(sql`${debugLogs.gameId} IS NOT NULL`)
      .groupBy(debugLogs.gameId)
      .orderBy(sql`MAX(${debugLogs.timestamp}) DESC`)
      .limit(MAX_GAMES_TO_KEEP);

    const recentGameIds = recentGames.map(g => g.gameId).filter(Boolean) as string[];

    if (recentGameIds.length === 0) {
      return 0;
    }

    // Delete logs for games not in the recent list
    const result = await db
      .delete(debugLogs)
      .where(sql`${debugLogs.gameId} IS NOT NULL AND ${debugLogs.gameId} NOT IN (${sql.join(recentGameIds.map(id => sql`${id}`), sql`, `)})`)
      .returning({ id: debugLogs.id });

    console.log(`[DebugService] Cleaned up ${result.length} old log entries`);
    return result.length;
  } catch (error) {
    console.error('[DebugService] Failed to cleanup old logs:', error);
    return 0;
  }
}

// Redact sensitive hand data from log entries
function redactHandData(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactHandData);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'hand' || key === 'playerHand' || key === 'handSummary') {
        result[key] = '[REDACTED]';
      } else {
        result[key] = redactHandData(val);
      }
    }
    return result;
  }
  return value;
}

export function redactLogEntry(entry: DebugLogEntry): DebugLogEntry {
  return {
    ...entry,
    eventData: redactHandData(entry.eventData),
    gameState: redactHandData(entry.gameState),
    metadata: redactHandData(entry.metadata),
  };
}

// Schedule periodic cleanup
let cleanupTimer: NodeJS.Timeout | null = null;

export function startPeriodicCleanup(intervalMs: number = 3600000): void { // Default: every hour
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  cleanupTimer = setInterval(async () => {
    await cleanupOldLogs();
  }, intervalMs);
}

export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
