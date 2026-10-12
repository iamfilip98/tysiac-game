import { runInDurableObject } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import type { Room } from '../src/room/Room';
import { firstMove, setupTable, type Client } from './client';
import { debugDump, patchRoom, sleep, stubFor } from './helpers';

type Patchable = { playBot: () => Promise<boolean> };

/** Makes every bot move in this room fail (as if the engine threw), or restores the real behaviour. */
async function breakBots(code: string, broken: boolean): Promise<void> {
  await runInDurableObject(stubFor(code), (room: Room) => {
    if (broken) (room as unknown as Patchable).playBot = async () => false;
    else delete (room as unknown as Partial<Patchable>).playBot;
  });
}

/** A started table (Ala + 2 bots) whose bots always fail, stopped on a bot's turn. */
async function stuckBotTable() {
  const table = await setupTable({ humans: ['Ala'], bots: 2, start: false });
  await breakBots(table.code, true);
  const [ala] = table.clients as [Client];
  ala.send({ t: 'lobby', op: { op: 'start' } });
  let s = await ala.next('state');
  while (s.view.turn === ala.id) {
    const id = ala.act(firstMove(s.view));
    await ala.next('ack', (m) => m.id === id);
    s = await ala.next('state', (m) => m.seq > s.seq);
  }
  return { ...table, ala, seq: s.seq };
}

async function waitFor<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeoutMs = 4000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const v = await read();
    if (ok(v)) return v;
    if (Date.now() > deadline) throw new Error('condition not met in time');
    await sleep(50);
  }
}

describe('bot failure handling', () => {
  it('retries after 1 s, then keeps retrying every 30 s instead of giving up', async () => {
    const { code, seq } = await stuckBotTable();
    const slow = await waitFor(() => debugDump(code), (d) => d.schedule.bot !== null && d.schedule.bot - Date.now() > 20_000);
    expect(slow.state?.seq).toBe(seq);

    // The slow retry is real: when it comes due and the bot works again, the game moves on.
    await breakBots(code, false);
    await patchRoom(code, (d) => {
      d.schedule.bot = Date.now() - 1;
    });
    await runInDurableObject(stubFor(code), (room: Room) => room.alarm());
    expect((await debugDump(code)).state!.seq).toBeGreaterThan(seq);
  });

  it('any incoming message re-plans a stalled bot immediately', async () => {
    const { code, ala, seq } = await stuckBotTable();
    await waitFor(() => debugDump(code), (d) => d.schedule.bot !== null && d.schedule.bot - Date.now() > 20_000);
    await breakBots(code, false);
    ala.sendRaw('{"t": "ping"}'); // not the exact auto-response string, so it reaches the Room
    await ala.next('pong');
    await waitFor(() => debugDump(code), (d) => d.state!.seq > seq, 5000);
  });
});

describe('presence sweep', () => {
  async function awayTable() {
    const table = await setupTable({ humans: ['Ala', 'Bartek'], bots: 1 });
    const [ala, bartek] = table.clients as [Client, Client];
    bartek.close();
    await ala.next('room', (m) => m.room.seats[1]?.connected === false);
    // Simulate a missed close handler (eviction/redeploy): the seat has no socket but is not marked away.
    await patchRoom(table.code, (d) => {
      d.meta.seats[1]!.awaySince = null;
    });
    return { ...table, ala };
  }

  it('an incoming message marks a seat with no socket as away', async () => {
    const { ala } = await awayTable();
    ala.sendRaw('{"t": "ping"}');
    const room = await ala.next('room', (m) => m.room.seats[1]?.awaySince != null);
    expect(room.room.seats[1]?.connected).toBe(false);
  });

  it('the alarm marks a seat with no socket as away', async () => {
    const { code } = await awayTable();
    await runInDurableObject(stubFor(code), (room: Room) => room.alarm());
    expect((await debugDump(code)).meta.seats[1]?.awaySince).toBeGreaterThan(0);
  });
});
