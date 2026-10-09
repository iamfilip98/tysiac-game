import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';
import type { GameState } from '@tysiac/engine';
import type { Room } from '../src/room/Room';
import { LOG_CAP, RoomStore } from '../src/room/storage';
import { createMeta } from '../src/room/lobby';

function withStore<R>(fn: (store: RoomStore) => R): Promise<R> {
  const stub = env.ROOMS.get(env.ROOMS.newUniqueId());
  return runInDurableObject(stub, (_room: Room, ctx) => fn(new RoomStore(ctx.storage.sql)));
}

describe('RoomStore', () => {
  it('does not exist until created, then round-trips meta, state, options and schedule', async () => {
    const result = await withStore((store) => {
      const before = store.exists();
      store.create();
      const meta = createMeta({ code: 'ABCDEF', maxPlayers: 3, hostId: 'h', name: 'H', avatar: '🙂', now: 1 });
      const state = { v: 1, seq: 7, seats: [], scores: {} } as unknown as GameState;
      const options = { seed: 'abc', seats: [], maxPlayers: 3 as const, firstDealer: 2 };
      const emptySchedule = store.getSchedule();
      const nothing = { meta: store.getMeta(), state: store.getState(), options: store.getGameOptions() };
      store.putMeta(meta);
      store.putState(state);
      store.putGameOptions(options);
      store.putSchedule({ bot: 5, cleanup: 9 });
      store.putMeta({ ...meta, firstDealer: 1 });
      return {
        before, after: store.exists(), emptySchedule, nothing,
        meta: store.getMeta(), state: store.getState(), options: store.getGameOptions(), schedule: store.getSchedule(),
      };
    });
    expect(result.before).toBe(false);
    expect(result.after).toBe(true);
    expect(result.emptySchedule).toEqual({ bot: null, cleanup: 0 });
    expect(result.nothing).toEqual({ meta: null, state: null, options: null });
    expect(result.meta?.firstDealer).toBe(1);
    expect(result.state).toEqual({ v: 1, seq: 7, seats: [], scores: {} });
    expect(result.options).toEqual({ seed: 'abc', seats: [], maxPlayers: 3, firstDealer: 2 });
    expect(result.schedule).toEqual({ bot: 5, cleanup: 9 });
  });

  it('keeps only the newest 5,000 log entries', async () => {
    const log = await withStore((store) => {
      store.create();
      for (let seq = 1; seq <= LOG_CAP + 3; seq++) {
        store.appendLog({ seq, at: seq * 10, player: seq % 2 ? 'a' : 'b', action: { type: 'bid', amount: 110 } });
      }
      return store.readLog();
    });
    expect(LOG_CAP).toBe(5000);
    expect(log).toHaveLength(5000);
    expect(log[0]).toEqual({ seq: 4, at: 40, player: 'b', action: { type: 'bid', amount: 110 } });
    expect(log.at(-1)?.seq).toBe(5003);
  });

  it('clearLog empties the log (new game)', async () => {
    const log = await withStore((store) => {
      store.create();
      store.appendLog({ seq: 1, at: 1, player: 'a', action: { type: 'pass' } });
      store.clearLog();
      return store.readLog();
    });
    expect(log).toEqual([]);
  });
});
