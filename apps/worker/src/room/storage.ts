import type { Action, GameState } from '@tysiac/engine';
import type { Schedule } from '../scheduler';
import type { GameOptions, LogEntry, RoomMeta } from './types';

/**
 * Action log cap (spec §6). Replay = createGame(gameOptions) + reduce over the log. Once a game passes this many
 * actions the oldest entries are dropped, so replay is unavailable for it (the log no longer starts at seq 1).
 * That is deliberate: the saved state stays authoritative and only replay-based checks or rebuilds are skipped.
 */
export const LOG_CAP = 5000;

type Key = 'meta' | 'state' | 'gameOptions' | 'schedule';
type KvRow = { value: string };
type LogRow = { seq: number; at: number; player: string; action: string };

/**
 * Room persistence on the DO's SQLite. All calls are synchronous; writes made in one event without
 * an intervening await are committed atomically by the runtime.
 */
export class RoomStore {
  constructor(private readonly sql: SqlStorage) {}

  /** Read-only check, so looking up a non-existent room never writes storage. */
  exists(): boolean {
    return this.sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'kv'").toArray().length > 0;
  }

  create(): void {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY, at INTEGER NOT NULL, player TEXT NOT NULL, action TEXT NOT NULL)',
    );
  }

  getMeta(): RoomMeta | null {
    return this.get<RoomMeta>('meta');
  }
  putMeta(meta: RoomMeta): void {
    this.put('meta', meta);
  }

  getState(): GameState | null {
    return this.get<GameState>('state');
  }
  putState(state: GameState): void {
    this.put('state', state);
  }

  getGameOptions(): GameOptions | null {
    return this.get<GameOptions>('gameOptions');
  }
  putGameOptions(options: GameOptions): void {
    this.put('gameOptions', options);
  }

  getSchedule(): Schedule {
    return this.get<Schedule>('schedule') ?? { bot: null, cleanup: 0 };
  }
  putSchedule(schedule: Schedule): void {
    this.put('schedule', schedule);
  }

  appendLog(entry: LogEntry): void {
    this.sql.exec(
      'INSERT OR REPLACE INTO log (seq, at, player, action) VALUES (?, ?, ?, ?)',
      entry.seq, entry.at, entry.player, JSON.stringify(entry.action),
    );
    if (entry.seq > LOG_CAP) this.sql.exec('DELETE FROM log WHERE seq <= ?', entry.seq - LOG_CAP);
  }

  readLog(): LogEntry[] {
    return this.sql
      .exec<LogRow>('SELECT seq, at, player, action FROM log ORDER BY seq')
      .toArray()
      .map((r) => ({ seq: r.seq, at: r.at, player: r.player, action: JSON.parse(r.action) as Action }));
  }

  clearLog(): void {
    this.sql.exec('DELETE FROM log');
  }

  private get<T>(key: Key): T | null {
    const row = this.sql.exec<KvRow>('SELECT value FROM kv WHERE key = ?', key).toArray()[0];
    return row ? (JSON.parse(row.value) as T) : null;
  }

  private put(key: Key, value: unknown): void {
    this.sql.exec(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key, JSON.stringify(value),
    );
  }
}
