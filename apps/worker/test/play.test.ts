import { describe, it, expect } from 'vitest';
import { connect, firstMove, helloMsg, join, setupTable } from './client';
import { createRoom, debugDump, ident, sleep } from './helpers';

describe('lobby ops', () => {
  it('host adds and removes bots with the house names', async () => {
    const { host } = await setupTable({ humans: ['Ala'], maxPlayers: 4, start: false });
    host.send({ t: 'lobby', op: { op: 'addBot' } });
    host.send({ t: 'lobby', op: { op: 'addBot' } });
    const two = await host.next('room', (m) => m.room.seats.filter((s) => s?.isBot).length === 2);
    expect(two.room.seats.map((s) => s?.name ?? null)).toEqual(['Ala', 'Bot Basia', 'Bot Zenek', null]);
    expect(two.room.seats[1]?.connected).toBe(true);
    host.send({ t: 'lobby', op: { op: 'removeBot', playerId: two.room.seats[1]!.id } });
    const one = await host.next('room', (m) => m.room.seats[1] === null);
    expect(one.room.seats[2]?.name).toBe('Bot Zenek');
  });

  it('only the host may add bots, choose the first dealer or start', async () => {
    const { clients } = await setupTable({ humans: ['Ala', 'Bartek'], start: false });
    const b = clients[1];
    for (const op of [{ op: 'addBot' }, { op: 'setFirstDealer', seat: 1 }, { op: 'start' }] as const) {
      b.send({ t: 'lobby', op });
      expect((await b.next('error')).code).toBe('notHost');
    }
  });

  it('anyone may swap seats; the host picks the first dealer', async () => {
    const { host, clients } = await setupTable({ humans: ['Ala', 'Bartek'], start: false });
    clients[1].send({ t: 'lobby', op: { op: 'swapSeats', a: 0, b: 1 } });
    const swapped = await host.next('room', (m) => m.room.seats[0]?.id === clients[1].id);
    expect(swapped.room.seats[1]?.id).toBe(host.id);
    host.send({ t: 'lobby', op: { op: 'setFirstDealer', seat: 2 } });
    expect((await host.next('room', (m) => m.room.firstDealer === 2)).room.firstDealer).toBe(2);
  });

  it('cannot start until every seat is filled', async () => {
    const { host } = await setupTable({ humans: ['Ala', 'Bartek'], start: false });
    host.send({ t: 'lobby', op: { op: 'start' } });
    const err = await host.next('error');
    expect(err.code).toBe('badMessage');
    expect(err.message).toMatch(/fill every seat/i);
  });

  it('start deals and sends each player a personal view in seat order', async () => {
    const { host, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'], start: false });
    host.send({ t: 'lobby', op: { op: 'swapSeats', a: 0, b: 2 } });
    host.send({ t: 'lobby', op: { op: 'setFirstDealer', seat: 1 } });
    await host.next('room', (m) => m.room.firstDealer === 1 && m.room.seats[2]?.id === host.id);
    host.send({ t: 'lobby', op: { op: 'start' } });
    const room = await host.next('room', (m) => m.room.status === 'playing');
    const order = room.room.seats.map((s) => s!.id);
    expect(order).toEqual([clients[2].id, clients[1].id, host.id]);
    for (const c of clients) {
      const s = await c.next('state');
      expect(s.seq).toBe(0);
      expect(s.events).toEqual([]);
      expect(s.view.me).toBe(c.id);
      expect(s.view.seats.map((x) => x.id)).toEqual(order);
      expect(s.view.firstDealer).toBe(1);
      expect(s.view.round?.hand).toHaveLength(7);
    }
  });

  it('refuses lobby changes and newcomers once the game started', async () => {
    const { code, host } = await setupTable({ humans: ['Ala'], bots: 2 });
    host.send({ t: 'lobby', op: { op: 'addBot' } });
    expect((await host.next('error')).code).toBe('gameInProgress');
    const late = ident('Darek');
    const d = await connect(code, late);
    d.send(helloMsg(late));
    expect((await d.next('error')).code).toBe('gameInProgress');
  });
});

describe('playing', () => {
  it('rejects acts before the game starts', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    const id = a.act({ type: 'pass' });
    expect(await a.next('reject')).toMatchObject({ id, code: 'notPlaying' });
  });

  it('an accepted act is acked to the sender and broadcast to everyone; an illegal one is rejected privately', async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    const mover = clients.find((c) => c.view!.turn === c.id)!;
    const other = clients.find((c) => c !== mover)!;

    const badId = other.act({ type: 'pass' });
    expect(await other.next('reject')).toMatchObject({ id: badId, code: 'notYourTurn', message: 'reject.notYourTurn', msg: { key: 'reject.notYourTurn' } });

    const id = mover.act(firstMove(mover.view!));
    await mover.next('ack', (m) => m.id === id);
    for (const c of clients) {
      const s = await c.next('state', (m) => m.seq === 1);
      expect(s.view.me).toBe(c.id);
      expect(s.events.length).toBeGreaterThan(0);
    }
    await sleep(100);
    expect(clients.filter((c) => c !== other).every((c) => !c.inbox.some((m) => m.t === 'reject'))).toBe(true);
    const dump = await debugDump(code);
    expect(dump.state?.seq).toBe(1);
    expect(dump.log).toHaveLength(1);
    expect(dump.log[0]).toMatchObject({ seq: 1, player: mover.id });
    expect(dump.gameOptions?.seats.map((s) => s.id)).toEqual(clients.map((c) => c.id));
  });

  it('a duplicate act (double tap) is applied once', async () => {
    const { code, clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    const mover = clients.find((c) => c.view!.turn === c.id)!;
    const move = firstMove(mover.view!);
    const first = mover.act(move);
    const second = mover.act(move);
    await mover.next('ack', (m) => m.id === first);
    expect(await mover.next('reject')).toMatchObject({ id: second, code: 'notYourTurn' });
    const dump = await debugDump(code);
    expect(dump.state?.seq).toBe(1);
    expect(dump.log).toHaveLength(1);
  });

  it('pause blocks everyone until any player resumes', async () => {
    const { clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    const mover = clients.find((c) => c.view!.turn === c.id)!;
    const [pauser, resumer] = clients.filter((c) => c !== mover);
    const move = firstMove(mover.view!);

    pauser.act({ type: 'pause' });
    for (const c of clients) {
      const s = await c.next('state', (m) => m.view.paused !== null);
      expect(s.view.paused?.by).toBe(pauser.id);
      expect(s.events.some((e) => e.type === 'paused')).toBe(true);
    }

    const blocked = mover.act(move);
    expect(await mover.next('reject', (m) => m.id === blocked)).toMatchObject({ code: 'paused' });

    resumer.act({ type: 'resume' });
    await mover.next('state', (m) => m.view.paused === null);
    const id = mover.act(move);
    await mover.next('ack', (m) => m.id === id);
  });

  it('a disconnect during the game marks the player away', async () => {
    const { clients } = await setupTable({ humans: ['Ala', 'Bartek', 'Celina'] });
    clients[1].close();
    const update = await clients[0].next('room', (m) => m.room.seats[1]?.connected === false);
    expect(update.room.seats[1]?.awaySince).toEqual(expect.any(Number));
    expect(update.room.seats[1]?.botFor).toBe(false);
  });
});
