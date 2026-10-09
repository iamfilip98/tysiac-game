import { describe, it, expect } from 'vitest';
import type { GameEvent } from '@tysiac/engine';
import { join, setupTable, type Client } from './client';
import { debugDump, patchRoom, sleep } from './helpers';

const ACTIONS = new Set(['bid', 'passed', 'threw', 'handedOut', 'cardPlayed']);
const actedBy = (events: GameEvent[], id: string) => events.some((e) => ACTIONS.has(e.type) && 'p' in e && e.p === id);

async function awayTable() {
  const table = await setupTable({ humans: ['Ala', 'Bartek'], bots: 1 });
  const [ala, bartek] = table.clients as [Client, Client];
  ala.autoplay = true;
  ala.playIfMyTurn();
  bartek.close();
  const update = await ala.next('room', (m) => m.room.seats[1]?.connected === false);
  return { ...table, ala, bartek, awaySince: update.room.seats[1]!.awaySince! };
}

describe('away players and botFor', () => {
  it('marks the disconnected player away and refuses botFor for 30 s', async () => {
    const { ala, bartek, awaySince } = await awayTable();
    expect(awaySince).toBeGreaterThan(0);
    ala.send({ t: 'botFor', playerId: bartek.id });
    const err = await ala.next('error');
    expect(err.code).toBe('badMessage');
    expect(err.message).toMatch(/30 s/);
    ala.autoplay = false;
  });

  it('after 30 s anyone may let a bot play for the away player', async () => {
    const { code, ala, bartek } = await awayTable();
    await patchRoom(code, (d) => {
      d.meta.seats[1]!.awaySince = Date.now() - 31_000;
    });
    ala.send({ t: 'botFor', playerId: bartek.id });
    const update = await ala.next('room', (m) => m.room.seats[1]?.botFor === true);
    expect(update.room.seats[1]?.connected).toBe(false);
    const s = await ala.next('state', (m) => actedBy(m.events, bartek.id), 20_000);
    expect(s.view.seats[1].botFor).toBe('bot');
    ala.autoplay = false;
  });

  it('reclaiming stops the bot from playing for you', async () => {
    const { code, ala, bartek } = await awayTable();
    await patchRoom(code, (d) => {
      d.meta.seats[1]!.awaySince = Date.now() - 31_000;
    });
    ala.send({ t: 'botFor', playerId: bartek.id });
    await ala.next('room', (m) => m.room.seats[1]?.botFor === true);

    const back = await join(code, bartek.who);
    expect(back.room?.seats[1]).toMatchObject({ connected: true, botFor: false, awaySince: null });
    await ala.next('room', (m) => m.room.seats[1]?.botFor === false && m.room.seats[1]?.connected === true);

    const myTurn = await back.next('state', (m) => m.view.turn === bartek.id && m.view.paused === null, 20_000);
    expect(myTurn.view.seats[1].botFor).toBeUndefined();
    await sleep(400);
    const dump = await debugDump(code);
    expect(dump.state?.seq).toBe(myTurn.seq);
    expect(dump.schedule.bot).toBeNull();
    ala.autoplay = false;
  });
});
