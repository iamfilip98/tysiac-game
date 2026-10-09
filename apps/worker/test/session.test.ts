import { describe, it, expect } from 'vitest';
import { connect, helloMsg, join } from './client';
import { createRoom, debugDump, ident, sleep } from './helpers';

describe('joining a room', () => {
  it('host hello claims the reserved seat and gets welcome (no state in the lobby)', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const c = await connect(code, ala);
    c.send(helloMsg(ala, true));
    const w = await c.next('welcome');
    expect(w.you).toBe(ala.playerId);
    expect(typeof w.serverTime).toBe('number');
    expect(w.room).toMatchObject({ code, status: 'lobby', maxPlayers: 3, hostId: ala.playerId, firstDealer: 0 });
    expect(w.room.seats[0]).toEqual({
      id: ala.playerId, name: 'Ala', avatar: '🙂', isBot: false, connected: true, awaySince: null, botFor: false, coach: true,
    });
    expect(w.room.seats.slice(1)).toEqual([null, null]);
    await sleep(100);
    expect(c.inbox.some((m) => m.t === 'state')).toBe(false);
  });

  it('others take the next free seat and everyone already there gets a room update', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    const bartek = ident('Bartek');
    const b = await join(code, bartek);
    expect(b.room?.seats[1]?.id).toBe(bartek.playerId);
    const update = await a.next('room', (m) => m.room.seats[1]?.id === bartek.playerId);
    expect(update.room.seats[1]?.connected).toBe(true);
  });

  it('rejects a known player id with the wrong secret and closes', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    await join(code, ala);
    const impostor = await connect(code, { ...ala, secret: crypto.randomUUID() });
    impostor.send(helloMsg({ ...ala, secret: crypto.randomUUID() }));
    expect((await impostor.next('error')).code).toBe('badSecret');
    expect(await impostor.closed()).toBe(1008);
  });

  it('rejects a fourth player in a full 3-player lobby', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    await join(code, ala);
    await join(code, ident('Bartek'));
    await join(code, ident('Celina'));
    const late = ident('Darek');
    const d = await connect(code, late);
    d.send(helloMsg(late));
    expect((await d.next('error')).code).toBe('roomFull');
    expect(await d.closed()).toBe(1008);
  });

  it('the first message must be hello', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const c = await connect(code, ala);
    c.send({ t: 'setCoach', coach: true });
    expect((await c.next('error')).code).toBe('badMessage');
    expect(await c.closed()).toBe(1008);
  });

  it('rejects other protocol versions', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const c = await connect(code, ala);
    c.send({ ...helloMsg(ala), v: 2 });
    expect((await c.next('error')).code).toBe('versionMismatch');
    expect(await c.closed()).toBe(1008);
  });

  it('a second socket for the same player replaces the first', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const first = await join(code, ala);
    const second = await join(code, ala);
    expect(await first.closed()).toBe(4000);
    expect(second.room?.seats[0]?.connected).toBe(true);
    await sleep(100);
    const dump = await debugDump(code);
    expect(dump.connected).toEqual([ala.playerId]);
    expect(dump.meta.seats[0]?.awaySince).toBeNull();
  });
});

describe('lobby presence', () => {
  it('setCoach is broadcast', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    const b = await join(code, ident('Bartek'));
    b.send({ t: 'setCoach', coach: true });
    const update = await a.next('room', (m) => m.room.seats[1]?.coach === true);
    expect(update.room.seats[1]?.name).toBe('Bartek');
  });

  it('leave frees the seat, passes host on and closes the socket', async () => {
    const ala = ident('Ala');
    const bartek = ident('Bartek');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    const b = await join(code, bartek);
    a.send({ t: 'leave' });
    expect(await a.closed()).toBe(1000);
    const update = await b.next('room', (m) => m.room.seats[0] === null);
    expect(update.room.hostId).toBe(bartek.playerId);
  });

  it('a lobby disconnect shows as not connected without marking away', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    const b = await join(code, ident('Bartek'));
    b.close();
    const update = await a.next('room', (m) => m.room.seats[1]?.connected === false);
    expect(update.room.seats[1]?.awaySince).toBeNull();
  });
});

describe('message limits', () => {
  it('answers exact pings (runtime auto-response) and other pings', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    a.sendRaw('{"t":"ping"}');
    await a.next('pong');
    a.sendRaw('{ "t": "ping" }');
    await a.next('pong');
  });

  it('rate-limits more than 20 messages per second with a single rateLimited error', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    for (let i = 0; i < 30; i++) a.send({ t: 'setCoach', coach: i % 2 === 0 });
    expect((await a.next('error')).code).toBe('rateLimited');
    await sleep(200);
    expect(a.inbox.filter((m) => m.t === 'error')).toEqual([]);
    expect(a.closeCode).toBeNull();
  });

  it('rejects oversize and malformed messages but keeps the socket open', async () => {
    const ala = ident('Ala');
    const code = await createRoom(ala);
    const a = await join(code, ala);
    a.sendRaw(JSON.stringify({ t: 'setCoach', coach: true, pad: 'x'.repeat(5000) }));
    expect((await a.next('error')).message).toMatch(/too large/i);
    a.send({ t: 'setCoach', coach: 'yes' });
    expect((await a.next('error')).code).toBe('badMessage');
    a.send({ t: 'hello', v: 1, playerId: ala.playerId, secret: ala.secret, name: 'Ala', avatar: '🙂', coach: false });
    expect((await a.next('error')).code).toBe('badMessage');
    a.send({ t: 'setCoach', coach: true });
    await a.next('room', (m) => m.room.seats[0]?.coach === true);
    expect(a.closeCode).toBeNull();
  });
});
