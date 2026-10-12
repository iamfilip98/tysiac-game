import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';
import type { HistoryResponse } from '@tysiac/protocol';
import { setupTable, type Client } from './client';
import { runInDurableObject } from 'cloudflare:test';
import type { Room } from '../src/room/Room';
import { call, debugDump, patchRoom, stubFor } from './helpers';

describe('end of game', () => {
  it('writes the finished game to history, then the host can start a rematch', { timeout: 120_000 }, async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek'], bots: 1 });
    const [ala, bartek] = clients as [Client, Client];

    // Fast-forward: everyone sits on 900 (the barrel), so the next bid that is made wins the game.
    await patchRoom(code, (d) => {
      for (const id of Object.keys(d.state!.scores)) d.state!.scores[id].total = 900;
    });
    for (const c of clients) {
      c.autoplay = true;
      c.playIfMyTurn();
    }

    const won = await ala.next('state', (m) => m.view.winner !== null, 100_000);
    const winner = won.view.winner!;
    expect(won.events.some((e) => e.type === 'gameWon')).toBe(true);
    await ala.next('room', (m) => m.room.status === 'finished');
    for (const c of clients) c.autoplay = false;

    const history = await (await call(`/api/history?player=${ala.id}`)).json<HistoryResponse>();
    expect(history.games).toHaveLength(1);
    expect(history.games[0]).toMatchObject({ winnerId: winner, playerCount: 3 });
    expect(history.games[0].players.map((p) => p.isBot)).toEqual([false, false, true]);
    expect(history.games[0].players.find((p) => p.id === winner)?.won).toBe(true);
    expect(history.headToHead).toEqual([expect.objectContaining({ opponentId: bartek.id, games: 1 })]);
    expect(history.leaderboard).toEqual([]); // games with a bot never count

    const before = await debugDump(code);
    expect(before.meta.status).toBe('finished');

    for (const c of clients) c.inbox.length = 0; // drop stale messages from the first game (its `playing` room, seq 0 state)
    bartek.send({ t: 'rematch' });
    expect((await bartek.next('error')).code).toBe('notHost');

    ala.send({ t: 'rematch' });
    const room = await ala.next('room', (m) => m.room.status === 'playing');
    expect(room.room.firstDealer).toBe((before.meta.firstDealer + 1) % 3);
    const fresh = await bartek.next('state', (m) => m.seq === 0);
    expect(fresh.view.winner).toBeNull();
    expect(fresh.view.rounds).toEqual([]);
    expect(Object.values(fresh.view.scores).every((s) => s.total === 0)).toBe(true);

    const after = await debugDump(code);
    expect(after.meta.gameId).not.toBe(before.meta.gameId);
    expect(after.log).toHaveLength(after.state!.seq); // the old game's log was cleared
  });

  it('survives a failed D1 write and saves the game exactly once on the alarm retry', { timeout: 120_000 }, async () => {
    const { code, clients } = await setupTable({ humans: ['Cezary'], bots: 2 });
    const [cezary] = clients as [Client];
    await patchRoom(code, (d) => {
      for (const id of Object.keys(d.state!.scores)) d.state!.scores[id].total = 900;
    });
    await env.DB.exec('ALTER TABLE games RENAME TO games_off');
    try {
      cezary.autoplay = true;
      cezary.playIfMyTurn();
      await cezary.next('room', (m) => m.room.status === 'finished', 100_000); // the room is not broken by the failure
      cezary.autoplay = false;
      expect((await debugDump(code)).meta.status).toBe('finished');
    } finally {
      await env.DB.exec('ALTER TABLE games_off RENAME TO games');
    }
    const history = async () => (await (await call(`/api/history?player=${cezary.id}`)).json<HistoryResponse>()).games;
    expect(await history()).toHaveLength(0);

    await patchRoom(code, (d) => {
      d.schedule.save = Date.now() - 1; // the retry is due
    });
    await runInDurableObject(stubFor(code), (room: Room) => room.alarm());
    expect(await history()).toHaveLength(1);
    // A second pass (e.g. an alarm re-run) writes nothing new.
    await runInDurableObject(stubFor(code), (room: Room) => room.alarm());
    expect(await history()).toHaveLength(1);
    expect((await debugDump(code)).schedule.save ?? null).toBeNull();
  });
});
