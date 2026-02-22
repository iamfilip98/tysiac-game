export interface QueueEntry {
  playerId: string;
  playerName: string;
  socketId: string;
  joinedAt: number;
  isRegistered: boolean;
}

const queue: QueueEntry[] = [];
const playersInQueue = new Set<string>();

let fillTimer: NodeJS.Timeout | null = null;

export function addToQueue(entry: QueueEntry): void {
  if (playersInQueue.has(entry.playerId)) return;
  queue.push(entry);
  playersInQueue.add(entry.playerId);
}

export function removeFromQueue(playerId: string): boolean {
  if (!playersInQueue.has(playerId)) return false;
  const idx = queue.findIndex(e => e.playerId === playerId);
  if (idx !== -1) queue.splice(idx, 1);
  playersInQueue.delete(playerId);
  return true;
}

export function removeBySocketId(socketId: string): QueueEntry | null {
  const idx = queue.findIndex(e => e.socketId === socketId);
  if (idx === -1) return null;
  const [entry] = queue.splice(idx, 1);
  playersInQueue.delete(entry.playerId);
  return entry;
}

export function isInQueue(playerId: string): boolean {
  return playersInQueue.has(playerId);
}

export function getQueueSize(): number {
  return queue.length;
}

/** Pop 3 players if available. Returns null if fewer than 3. */
export function tryMatch(): QueueEntry[] | null {
  if (queue.length < 3) return null;
  const matched = queue.splice(0, 3);
  for (const entry of matched) {
    playersInQueue.delete(entry.playerId);
  }
  return matched;
}

/** Drain all remaining players from the queue. */
export function drainQueue(): QueueEntry[] {
  const entries = queue.splice(0, queue.length);
  playersInQueue.clear();
  return entries;
}

/** Start a 30s fill timer. Fires callback when timer expires. */
export function startFillTimer(callback: () => void): void {
  if (fillTimer) return; // already running
  fillTimer = setTimeout(() => {
    fillTimer = null;
    callback();
  }, 30_000);
}

export function cancelFillTimer(): void {
  if (fillTimer) {
    clearTimeout(fillTimer);
    fillTimer = null;
  }
}

export function isFillTimerRunning(): boolean {
  return fillTimer !== null;
}
