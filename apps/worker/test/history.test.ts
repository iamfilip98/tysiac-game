import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';
import type { GameState } from '@tysiac/engine';
import { gameRecordFrom, getHistory, recordGame, saveGameSafely, type GameRecord } from '../src/history';
import type { RoomMeta } from '../src/room/types';

const uid = () => crypto.randomUUID().slice(0, 8);

type Row = [id: string, isBot: boolean, score: number, won: boolean];

function record(id: string, finishedAt: number, rows: Row[]): GameRecord {
  return {
    id, roomCode: 'ABCDEF', startedAt: finishedAt - 1000, finishedAt,
    winnerId: rows.find((r) => r[3])![0],
    rounds: [{ number: 1 }],
    players: rows.map(([pid, isBot, finalScore, won], seat) => ({ id: pid, name: `N-${pid}`, avatar: '🙂', seat, isBot, finalScore, won })),
  };
}

describe('history', () => {
  it('is empty for an unknown player', async () => {
    expect(await getHistory(env.DB, `ghost-${uid()}`)).toEqual({ games: [], headToHead: [], leaderboard: [] });
  });

  it('lists games newest first, head-to-head vs humans, and a bot-free leaderboard', async () => {
    const s = uid();
    const [a, b, c, bot1, bot2] = ['a', 'b', 'c', 'bot1', 'bot2'].map((x) => `${x}-${s}`);
    await recordGame(env.DB, record(`g1-${s}`, 1000, [[a, false, 1010, true], [b, false, 640, false], [c, false, 220, false]]));
    await recordGame(env.DB, record(`g2-${s}`, 2000, [[a, false, 300, false], [bot1, true, 1020, true], [bot2, true, 500, false]]));
    await recordGame(env.DB, record(`g3-${s}`, 3000, [[b, false, 1000, true], [a, false, 900, false], [c, false, 100, false]]));

    const h = await getHistory(env.DB, a);
    expect(h.games.map((g) => g.id)).toEqual([`g3-${s}`, `g2-${s}`, `g1-${s}`]);
    expect(h.games[1]).toEqual({
      id: `g2-${s}`, finishedAt: 2000, playerCount: 3, winnerId: bot1,
      players: [
        { id: a, name: `N-${a}`, avatar: '🙂', isBot: false, finalScore: 300, won: false },
        { id: bot1, name: `N-${bot1}`, avatar: '🙂', isBot: true, finalScore: 1020, won: true },
        { id: bot2, name: `N-${bot2}`, avatar: '🙂', isBot: true, finalScore: 500, won: false },
      ],
    });
    expect(h.headToHead).toEqual([
      { opponentId: b, name: `N-${b}`, avatar: '🙂', games: 2, wins: 1, losses: 1 },
      { opponentId: c, name: `N-${c}`, avatar: '🙂', games: 2, wins: 1, losses: 0 },
    ]);
    expect(h.leaderboard).toEqual([
      { playerId: a, name: `N-${a}`, avatar: '🙂', games: 2, wins: 1 },
      { playerId: b, name: `N-${b}`, avatar: '🙂', games: 2, wins: 1 },
      { playerId: c, name: `N-${c}`, avatar: '🙂', games: 2, wins: 0 },
    ]);
  });

  it('recording the same game twice is harmless', async () => {
    const s = uid();
    const g = record(`dup-${s}`, 10, [[`x-${s}`, false, 1000, true], [`y-${s}`, false, 0, false], [`z-${s}`, false, 0, false]]);
    await recordGame(env.DB, g);
    await recordGame(env.DB, g);
    expect((await getHistory(env.DB, `x-${s}`)).games).toHaveLength(1);
  });

  it('saveGameSafely swallows D1 failures', async () => {
    const broken = { prepare: () => { throw new Error('D1 is down'); } } as unknown as D1Database;
    const s = uid();
    const g = record(`safe-${s}`, 10, [[`x-${s}`, false, 1000, true], [`y-${s}`, false, 0, false], [`z-${s}`, false, 0, false]]);
    await expect(saveGameSafely(broken, g)).resolves.toBe(false);
    await expect(saveGameSafely(env.DB, null)).resolves.toBe(false);
    await expect(saveGameSafely(env.DB, g)).resolves.toBe(true);
  });

  it('gameRecordFrom builds the record from room meta and final state', () => {
    const state = {
      seats: [
        { id: 'x', name: 'X', avatar: '🦊', isBot: false },
        { id: 'y', name: 'Bot Basia', avatar: '🤖', isBot: true },
        { id: 'z', name: 'Z', avatar: '🐻', isBot: false, botFor: 'bot' },
      ],
      scores: { x: { total: 1010, history: [] }, y: { total: 500, history: [] }, z: { total: 20, history: [] } },
      rounds: [{ number: 1 }],
      winner: 'x',
    } as unknown as GameState;
    const meta = { code: 'ABCDEF', gameId: 'g-1', startedAt: 5 } as RoomMeta;
    expect(gameRecordFrom(meta, state, 99)).toEqual({
      id: 'g-1', roomCode: 'ABCDEF', startedAt: 5, finishedAt: 99, winnerId: 'x', rounds: [{ number: 1 }],
      players: [
        { id: 'x', name: 'X', avatar: '🦊', seat: 0, isBot: false, finalScore: 1010, won: true },
        { id: 'y', name: 'Bot Basia', avatar: '🤖', seat: 1, isBot: true, finalScore: 500, won: false },
        { id: 'z', name: 'Z', avatar: '🐻', seat: 2, isBot: false, finalScore: 20, won: false },
      ],
    });
    expect(gameRecordFrom(meta, { ...state, winner: null }, 99)).toBeNull();
    expect(gameRecordFrom({ ...meta, gameId: null }, state, 99)).toBeNull();
  });
});
