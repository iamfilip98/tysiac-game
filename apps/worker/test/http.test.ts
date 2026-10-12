import { runDurableObjectAlarm } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import type { CreateRoomResponse, HistoryResponse, RoomExistsResponse } from '@tysiac/protocol';
import type { DebugDump } from '../src/room/types';
import { DEBUG_KEY, call, createRoom, ident, patchRoom, stubFor } from './helpers';

const post = (body: string) =>
  call('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body });

describe('POST /api/rooms', () => {
  it('creates a room with a 6-character code', async () => {
    const res = await post(JSON.stringify({ maxPlayers: 3, playerId: 'p-http-1', name: 'Ala', avatar: '🦊' }));
    expect(res.status).toBe(200);
    const { code } = await res.json<CreateRoomResponse>();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('rejects malformed bodies with 400 and huge ones with 413', async () => {
    const good = { maxPlayers: 3, playerId: 'p', name: 'Ala', avatar: '🦊' };
    for (const body of ['nope', '{}', JSON.stringify({ ...good, maxPlayers: 5 }), JSON.stringify({ ...good, extra: 1 })]) {
      expect((await post(body)).status).toBe(400);
    }
    expect((await post(JSON.stringify({ ...good, name: 'x'.repeat(5000) }))).status).toBe(413);
  });
});

describe('GET /api/rooms/:code', () => {
  it('reports a lobby with the host seat reserved, case-insensitively', async () => {
    const code = await createRoom(ident('Ala'), 4);
    const expected: RoomExistsResponse = { exists: true, status: 'lobby', maxPlayers: 4, seatsTaken: 1 };
    expect(await (await call(`/api/rooms/${code}`)).json()).toEqual(expected);
    expect(await (await call(`/api/rooms/${code.toLowerCase()}`)).json()).toEqual(expected);
  });

  it('says exists:false for unknown and malformed codes', async () => {
    expect(await (await call('/api/rooms/ZZZZZ9')).json()).toEqual({ exists: false });
    expect(await (await call('/api/rooms/abc')).json()).toEqual({ exists: false });
  });
});

describe('GET /ws/:code', () => {
  it('requires a WebSocket upgrade', async () => {
    const code = await createRoom(ident('Ala'));
    expect((await call(`/ws/${code}`)).status).toBe(426);
  });

  it('404s for unknown or malformed rooms', async () => {
    const upgrade = { headers: { Upgrade: 'websocket' } };
    expect((await call('/ws/ZZZZZ8', upgrade)).status).toBe(404);
    expect((await call('/ws/not-a-code', upgrade)).status).toBe(404);
  });

  it('upgrades for a real room', async () => {
    const code = await createRoom(ident('Ala'));
    const res = await call(`/ws/${code}`, { headers: { Upgrade: 'websocket' } });
    expect(res.status).toBe(101);
    res.webSocket!.accept();
    res.webSocket!.close(1000, 'done');
  });
});

describe('GET /api/debug/rooms/:code', () => {
  it('needs the right x-debug-key', async () => {
    const code = await createRoom(ident('Ala'));
    expect((await call(`/api/debug/rooms/${code}`)).status).toBe(404);
    expect((await call(`/api/debug/rooms/${code}`, { headers: { 'x-debug-key': 'wrong' } })).status).toBe(404);
    expect((await call('/api/debug/rooms/ZZZZZ7', { headers: { 'x-debug-key': DEBUG_KEY } })).status).toBe(404);
  });

  it('dumps meta (without secrets), state, log and schedule', async () => {
    const host = ident('Ala');
    const code = await createRoom(host);
    const res = await call(`/api/debug/rooms/${code}`, { headers: { 'x-debug-key': DEBUG_KEY } });
    expect(res.status).toBe(200);
    const dump = await res.json<DebugDump>();
    expect(dump.meta).toMatchObject({ code, status: 'lobby', hostId: host.playerId, maxPlayers: 3 });
    expect(dump.meta.seats[0]).not.toHaveProperty('secretHash');
    expect(dump).toMatchObject({ state: null, gameOptions: null, log: [], connected: [] });
    expect(dump.schedule.bot).toBeNull();
    expect(dump.schedule.cleanup).toBeGreaterThan(Date.now() + 6 * 24 * 3600 * 1000);
  });
});

describe('GET /api/history', () => {
  it('needs ?player=', async () => {
    expect((await call('/api/history')).status).toBe(400);
  });

  it('returns empty lists for a new player', async () => {
    const res = await call('/api/history?player=nobody-yet');
    expect(res.status).toBe(200);
    const expected: HistoryResponse = { games: [], headToHead: [], leaderboard: [] };
    expect(await res.json()).toEqual(expected);
  });
});

describe('cleanup alarm', () => {
  it('deletes the room once the cleanup time has passed', async () => {
    const code = await createRoom(ident('Ala'));
    await patchRoom(code, (d) => {
      d.schedule.cleanup = Date.now() - 1;
    });
    expect(await runDurableObjectAlarm(stubFor(code))).toBe(true);
    expect(await (await call(`/api/rooms/${code}`)).json()).toEqual({ exists: false });
  });
});

it('unknown paths are JSON 404s', async () => {
  const res = await call('/api/rooms/ABCDEF/extra');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'Not found' });
});
