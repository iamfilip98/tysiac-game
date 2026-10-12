import { evictDurableObject } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { createGame, reduce } from '@tysiac/engine';
import type { GameState } from '@tysiac/engine';
import { firstMove, join, setupTable, type Client } from './client';
import { debugDump, sleep, stubFor } from './helpers';

const moverOf = (clients: Client[]): Client => {
  const mover = clients.find((c) => c.view?.turn === c.id);
  if (!mover) throw new Error('nobody to move');
  return mover;
};

describe('persistence', () => {
  it('state survives eviction and reconnecting players get it back', async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    const mover = moverOf(clients);
    const id = mover.act(firstMove(mover.view!));
    await mover.next('ack', (m) => m.id === id);
    for (const c of clients) await c.next('state', (m) => m.seq === 1);

    await evictDurableObject(stubFor(code), { webSockets: 'close' });
    for (const c of clients) await c.closed();

    const again: Client[] = [];
    for (const c of clients) {
      const fresh = await join(code, c.who);
      const s = await fresh.next('state');
      expect(s.seq).toBe(1);
      expect(s.events).toEqual([]);
      expect(s.view.me).toBe(c.id);
      again.push(fresh);
    }
    const next = moverOf(again);
    const id2 = next.act(firstMove(next.view!));
    await next.next('ack', (m) => m.id === id2);
    expect((await debugDump(code)).state?.seq).toBe(2);
  });

  it('hibernated sockets keep their identity', async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    await evictDurableObject(stubFor(code)); // default: sockets hibernate and stay open
    const mover = moverOf(clients);
    const id = mover.act(firstMove(mover.view!));
    await mover.next('ack', (m) => m.id === id);
    for (const c of clients) expect((await c.next('state', (m) => m.seq === 1)).view.me).toBe(c.id);
    expect((await debugDump(code)).connected.sort()).toEqual(clients.map((c) => c.id).sort());
  });

  it('seed + action log replays to exactly the stored state', async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    for (const c of clients) {
      c.autoplay = true;
      c.playIfMyTurn();
    }
    await clients[0].next('state', (m) => m.seq >= 12, 15_000);
    for (const c of clients) c.autoplay = false;
    await sleep(300);

    const dump = await debugDump(code);
    let state: GameState = createGame(dump.gameOptions!);
    for (const entry of dump.log) {
      const result = reduce(state, entry.player, entry.action, entry.at);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state).toEqual(dump.state);
    expect(dump.log.map((e) => e.seq)).toEqual(Array.from({ length: dump.state!.seq }, (_, i) => i + 1));
  });
});
