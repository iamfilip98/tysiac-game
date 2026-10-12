import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROTOCOL_VERSION, type ServerMessage } from './protocol';
import { SocketConnection, backoffDelay, type SocketLike } from './socket';
import type { HelloMessage } from './connection';

class FakeWS implements SocketLike {
  static instances: FakeWS[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev?: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWS.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.();
  }
  accept() {
    this.readyState = 1;
    this.onopen?.();
  }
  message(m: unknown) {
    this.onmessage?.({ data: typeof m === 'string' ? m : JSON.stringify(m) });
  }
  welcome() {
    this.message({ t: 'welcome', you: 'p', room: {}, serverTime: 0 });
  }
  drop(code?: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const hello: HelloMessage = { t: 'hello', v: PROTOCOL_VERSION, playerId: 'p', secret: 's', name: 'Filip', avatar: '🦊', coach: false };
const make = (opts = {}) => new SocketConnection('ABCDEF', () => hello, { WebSocketImpl: FakeWS, ...opts });
const latest = () => FakeWS.instances[FakeWS.instances.length - 1];
const sentMsgs = () => latest().sent.map(s => JSON.parse(s));

describe('SocketConnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWS.instances = [];
  });
  afterEach(() => vi.useRealTimers());

  it('connects to /ws/:code on this host and sends hello first', () => {
    const conn = make();
    expect(latest().url).toBe(`ws://${window.location.host}/ws/ABCDEF`);
    expect(conn.status).toBe('connecting');
    latest().accept();
    expect(conn.status).toBe('connecting');
    expect(sentMsgs()).toEqual([hello]);
    latest().welcome();
    expect(conn.status).toBe('open');
    conn.close();
  });

  it('stays reconnecting after a re-open until welcome', () => {
    const conn = make();
    latest().accept();
    latest().welcome();
    latest().drop();
    vi.advanceTimersByTime(500);
    latest().accept();
    expect(conn.status).toBe('reconnecting');
    latest().welcome();
    expect(conn.status).toBe('open');
    conn.close();
  });

  it('emits parsed server messages and ignores garbage', () => {
    const conn = make();
    const got: ServerMessage[] = [];
    conn.onMessage(m => got.push(m));
    latest().accept();
    latest().message('not json{');
    latest().message({ t: 'pong' });
    expect(got).toEqual([{ t: 'pong' }]);
    conn.close();
  });

  it('send returns false until connected and welcomed, so nothing precedes welcome', () => {
    const conn = make();
    expect(conn.send({ t: 'ping' })).toBe(false);
    latest().accept();
    expect(conn.send({ t: 'ping' })).toBe(false);
    expect(sentMsgs()).toEqual([hello]);
    latest().welcome();
    expect(conn.send({ t: 'ping' })).toBe(true);
    expect(sentMsgs()).toEqual([hello, { t: 'ping' }]);
    conn.close();
  });

  it('reconnects with backoff 0.5 → 5 s, re-sends hello, and resets after welcome', () => {
    const conn = make();
    const statuses: string[] = [];
    conn.onStatus(s => statuses.push(s));
    latest().accept();
    latest().welcome();
    latest().drop();
    expect(conn.status).toBe('reconnecting');
    for (const delay of [500, 1000, 2000, 4000, 5000, 5000]) {
      const n = FakeWS.instances.length;
      vi.advanceTimersByTime(delay - 1);
      expect(FakeWS.instances.length).toBe(n);
      vi.advanceTimersByTime(1);
      expect(FakeWS.instances.length).toBe(n + 1);
      latest().drop();
    }
    vi.advanceTimersByTime(5000);
    latest().accept();
    expect(sentMsgs()).toEqual([hello]);
    // opened but never welcomed: backoff must not reset
    latest().drop();
    let n = FakeWS.instances.length;
    vi.advanceTimersByTime(4999);
    expect(FakeWS.instances.length).toBe(n);
    vi.advanceTimersByTime(1);
    expect(FakeWS.instances.length).toBe(n + 1);
    latest().accept();
    latest().welcome();
    latest().drop();
    n = FakeWS.instances.length;
    vi.advanceTimersByTime(500);
    expect(FakeWS.instances.length).toBe(n + 1);
    expect(statuses).toContain('open');
    conn.close();
  });

  it('pings every 20 s once welcomed, not before', () => {
    const conn = make();
    latest().accept();
    vi.advanceTimersByTime(40_000);
    expect(sentMsgs()).toEqual([hello]);
    latest().welcome();
    vi.advanceTimersByTime(40_000);
    expect(sentMsgs().slice(1)).toEqual([{ t: 'ping' }, { t: 'ping' }]);
    conn.close();
  });

  it('close() stops reconnecting', () => {
    const conn = make();
    latest().accept();
    conn.close();
    expect(conn.status).toBe('closed');
    expect(conn.closeReason).toBe('user');
    const n = FakeWS.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances.length).toBe(n);
  });

  it.each([[4000, 'replaced'], [1008, 'protocol']])('close code %i is terminal (%s)', (code, reason) => {
    const conn = make();
    latest().accept();
    latest().welcome();
    latest().drop(code);
    expect(conn.status).toBe('closed');
    expect(conn.closeReason).toBe(reason);
    const n = FakeWS.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances.length).toBe(n);
  });

  it.each(['versionMismatch', 'badSecret'])('error %s is delivered, then terminal', code => {
    const conn = make();
    const got: ServerMessage[] = [];
    conn.onMessage(m => got.push(m));
    latest().accept();
    latest().message({ t: 'error', code, message: 'x' });
    expect(got).toHaveLength(1);
    expect(conn.status).toBe('closed');
    expect(conn.closeReason).toBe('rejected');
    const n = FakeWS.instances.length;
    vi.advanceTimersByTime(60_000);
    expect(FakeWS.instances.length).toBe(n);
  });

  it('other errors do not end the connection', () => {
    const conn = make();
    latest().accept();
    latest().welcome();
    latest().message({ t: 'error', code: 'rateLimited', message: 'x' });
    expect(conn.status).toBe('open');
    conn.close();
  });

  it('backoffDelay doubles up to 5 s', () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffDelay)).toEqual([500, 1000, 2000, 4000, 5000, 5000]);
  });
});
