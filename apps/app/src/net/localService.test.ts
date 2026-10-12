import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, type ServerMessage } from './protocol';
import { LocalHub, localService } from './localService';
import type { ConnStatus, HelloMessage } from './connection';

const hello = (id = 'p1'): HelloMessage => ({ t: 'hello', v: PROTOCOL_VERSION, playerId: id, secret: `s-${id}`, name: 'Filip', avatar: '🦊', coach: true });

function collect(conn: { onMessage(fn: (m: ServerMessage) => void): () => void; onStatus(fn: (s: ConnStatus) => void): () => void }) {
  const msgs: ServerMessage[] = [];
  const statuses: ConnStatus[] = [];
  conn.onMessage(m => msgs.push(m));
  conn.onStatus(s => statuses.push(s));
  return { msgs, statuses };
}

describe('localService', () => {
  afterEach(() => vi.useRealTimers());

  it('creates a room and connects asynchronously', async () => {
    vi.useFakeTimers();
    const svc = localService(new LocalHub());
    const { code } = await svc.createRoom({ maxPlayers: 3, playerId: 'p1', name: 'Filip', avatar: '🦊' });
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(await svc.roomExists(code)).toMatchObject({ exists: true, status: 'lobby', seatsTaken: 1 });
    const conn = svc.connect(code, () => hello());
    const got = collect(conn);
    expect(conn.status).toBe('connecting');
    expect(got.msgs).toEqual([]);
    await vi.runAllTimersAsync();
    expect(got.statuses).toEqual(['open']);
    expect(got.msgs[0]).toMatchObject({ t: 'welcome', you: 'p1' });
  });

  it('reports a missing room and closes', async () => {
    vi.useFakeTimers();
    const svc = localService(new LocalHub());
    expect(await svc.roomExists('ZZZZZZ')).toEqual({ exists: false });
    const conn = svc.connect('ZZZZZZ', () => hello());
    const got = collect(conn);
    await vi.runAllTimersAsync();
    expect(got.msgs).toEqual([{ t: 'error', code: 'notInRoom', message: 'That room does not exist' }]);
    expect(conn.status).toBe('closed');
  });

  it('refuses to send before open and stops delivering after close', async () => {
    vi.useFakeTimers();
    const svc = localService(new LocalHub());
    const { code } = await svc.createRoom({ maxPlayers: 3, playerId: 'p1', name: 'Filip', avatar: '🦊' });
    const conn = svc.connect(code, () => hello());
    expect(conn.send({ t: 'ping' })).toBe(false);
    const got = collect(conn);
    await vi.runAllTimersAsync();
    expect(conn.send({ t: 'ping' })).toBe(true);
    conn.close();
    await vi.runAllTimersAsync();
    expect(got.msgs.some(m => m.t === 'pong')).toBe(false);
    expect(conn.status).toBe('closed');
  });

  it('runs a practice game: two bots and start', async () => {
    vi.useFakeTimers();
    const svc = localService(new LocalHub({ botDelayScale: 0.01 }));
    const { code } = await svc.createRoom({ maxPlayers: 3, playerId: 'p1', name: 'Filip', avatar: '🦊' });
    const conn = svc.connect(code, () => hello());
    const got = collect(conn);
    await vi.runAllTimersAsync();
    conn.send({ t: 'lobby', op: { op: 'addBot' } });
    conn.send({ t: 'lobby', op: { op: 'addBot' } });
    conn.send({ t: 'lobby', op: { op: 'start' } });
    await vi.advanceTimersByTimeAsync(10);
    const state = got.msgs.find(m => m.t === 'state');
    expect(state && state.t === 'state' && state.view.round!.hand.length).toBe(7);
  });
});
