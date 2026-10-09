import type { GameState, PlayerId } from '@tysiac/engine';
import type { HeadToHead, HistoryGame, HistoryResponse, LeaderboardRow } from '@tysiac/protocol';
import type { RoomMeta } from './room/types';

export interface GameRecordPlayer {
  id: PlayerId;
  name: string;
  avatar: string;
  seat: number;
  isBot: boolean;
  finalScore: number;
  won: boolean;
}

export interface GameRecord {
  id: string;
  roomCode: string;
  startedAt: number;
  finishedAt: number;
  winnerId: PlayerId;
  rounds: unknown;
  players: GameRecordPlayer[];
}

type GameRow = { id: string; finished_at: number; player_count: number; winner_id: string };
type PlayerRow = {
  game_id: string; player_id: string; seat: number; is_bot: number; final_score: number; won: number; name: string; avatar: string;
};
type HeadToHeadRow = { opponentId: string; name: string; avatar: string; games: number; wins: number; losses: number };
type BoardRow = { playerId: string; name: string; avatar: string; games: number; wins: number };

const RECENT_GAMES = 20;

const GAMES_SQL = `
  SELECT g.id, g.finished_at, g.player_count, g.winner_id
  FROM games g
  JOIN game_players me ON me.game_id = g.id AND me.player_id = ?1
  ORDER BY g.finished_at DESC
  LIMIT ${RECENT_GAMES}`;

const PLAYERS_SQL = `
  SELECT gp.game_id, gp.player_id, gp.seat, gp.is_bot, gp.final_score, gp.won, p.name, p.avatar
  FROM game_players gp
  JOIN players p ON p.id = gp.player_id
  WHERE gp.game_id IN (SELECT value FROM json_each(?1))
  ORDER BY gp.game_id, gp.seat`;

const HEAD_TO_HEAD_SQL = `
  SELECT o.player_id AS opponentId, p.name AS name, p.avatar AS avatar, COUNT(*) AS games,
         SUM(me.won) AS wins, SUM(o.won) AS losses
  FROM game_players me
  JOIN game_players o ON o.game_id = me.game_id AND o.player_id <> me.player_id AND o.is_bot = 0
  JOIN players p ON p.id = o.player_id
  WHERE me.player_id = ?1
  GROUP BY o.player_id
  ORDER BY games DESC, name ASC`;

/** You + every human you have played with; only games without bots count. */
const LEADERBOARD_SQL = `
  WITH circle(id) AS (
    SELECT ?1
    UNION
    SELECT o.player_id FROM game_players me
    JOIN game_players o ON o.game_id = me.game_id
    WHERE me.player_id = ?1 AND o.is_bot = 0
  ),
  human_games(id) AS (
    SELECT g.id FROM games g
    WHERE NOT EXISTS (SELECT 1 FROM game_players b WHERE b.game_id = g.id AND b.is_bot = 1)
  )
  SELECT gp.player_id AS playerId, p.name AS name, p.avatar AS avatar, COUNT(*) AS games, SUM(gp.won) AS wins
  FROM game_players gp
  JOIN circle c ON c.id = gp.player_id
  JOIN human_games h ON h.id = gp.game_id
  JOIN players p ON p.id = gp.player_id
  GROUP BY gp.player_id
  ORDER BY wins DESC, games DESC, name ASC
  LIMIT 50`;

export function gameRecordFrom(meta: RoomMeta, state: GameState, now: number): GameRecord | null {
  if (state.winner === null || meta.gameId === null) return null;
  const winner = state.winner;
  return {
    id: meta.gameId,
    roomCode: meta.code,
    startedAt: meta.startedAt ?? now,
    finishedAt: now,
    winnerId: winner,
    rounds: state.rounds,
    players: state.seats.map((s, seat) => ({
      id: s.id, name: s.name, avatar: s.avatar, seat, isBot: s.isBot,
      finalScore: state.scores[s.id]?.total ?? 0, won: s.id === winner,
    })),
  };
}

export async function recordGame(db: D1Database, g: GameRecord): Promise<void> {
  await db.batch([
    db
      .prepare(
        'INSERT OR IGNORE INTO games (id, room_code, player_count, started_at, finished_at, winner_id, rounds_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(g.id, g.roomCode, g.players.length, g.startedAt, g.finishedAt, g.winnerId, JSON.stringify(g.rounds)),
    ...g.players.flatMap((p) => [
      db
        .prepare(
          'INSERT INTO players (id, name, avatar, last_seen) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, last_seen = excluded.last_seen',
        )
        .bind(p.id, p.name, p.avatar, g.finishedAt),
      db
        .prepare('INSERT OR IGNORE INTO game_players (game_id, player_id, seat, is_bot, final_score, won) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(g.id, p.id, p.seat, p.isBot ? 1 : 0, p.finalScore, p.won ? 1 : 0),
    ]),
  ]);
}

/** History must never affect the game (spec §6): failures are logged and swallowed. */
export async function saveGameSafely(db: D1Database, record: GameRecord | null): Promise<boolean> {
  if (!record) return false;
  try {
    await recordGame(db, record);
    return true;
  } catch (err) {
    console.error('history insert failed', { game: record.id, error: String(err) });
    return false;
  }
}

export async function getHistory(db: D1Database, playerId: PlayerId): Promise<HistoryResponse> {
  const games = (await db.prepare(GAMES_SQL).bind(playerId).all<GameRow>()).results;
  const ids = games.map((g) => g.id);
  const players = ids.length === 0 ? [] : (await db.prepare(PLAYERS_SQL).bind(JSON.stringify(ids)).all<PlayerRow>()).results;
  const headToHead = (await db.prepare(HEAD_TO_HEAD_SQL).bind(playerId).all<HeadToHeadRow>()).results;
  const leaderboard = (await db.prepare(LEADERBOARD_SQL).bind(playerId).all<BoardRow>()).results;

  const byGame = new Map<string, HistoryGame['players']>();
  for (const r of players) {
    const list = byGame.get(r.game_id) ?? [];
    list.push({ id: r.player_id, name: r.name, avatar: r.avatar, isBot: r.is_bot === 1, finalScore: r.final_score, won: r.won === 1 });
    byGame.set(r.game_id, list);
  }

  return {
    games: games.map((g) => ({
      id: g.id, finishedAt: g.finished_at, playerCount: g.player_count === 4 ? 4 : 3, winnerId: g.winner_id,
      players: byGame.get(g.id) ?? [],
    })),
    headToHead: headToHead.map(
      (r): HeadToHead => ({ opponentId: r.opponentId, name: r.name, avatar: r.avatar, games: r.games, wins: r.wins, losses: r.losses }),
    ),
    leaderboard: leaderboard.map(
      (r): LeaderboardRow => ({ playerId: r.playerId, name: r.name, avatar: r.avatar, games: r.games, wins: r.wins }),
    ),
  };
}
