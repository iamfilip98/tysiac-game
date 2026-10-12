import type { ClientMessage, ServerMessage } from './protocol';
import { Emitter, type CloseReason, type ConnStatus, type HelloMessage, type RoomConnection } from './connection';

/** The part of the browser WebSocket this class uses (lets tests pass a fake). */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev?: { code?: number }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
}

export interface SocketOptions {
  url?: string;
  WebSocketImpl?: new (url: string) => SocketLike;
  pingMs?: number;
}

const OPEN = 1;
/** Close codes after which reconnecting cannot help: replaced by another tab, protocol error. */
const FATAL_CLOSE_CODES: ReadonlySet<number> = new Set([4000, 1008]);
/** Server errors that end the connection for good. */
const TERMINAL_ERRORS: ReadonlySet<string> = new Set(['versionMismatch', 'badSecret']);

/** Silence longer than this while "open" makes a wake-up send a probe ping. */
const STALE_MS = 10_000;
/** A probe ping unanswered for this long means the socket is dead. */
const PROBE_MS = 3_000;

export type { CloseReason };

export function backoffDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 5000);
}

export class SocketConnection implements RoomConnection {
  status: ConnStatus = 'connecting';
  /** Why the connection ended for good (set together with status 'closed'). */
  closeReason?: CloseReason;
  private ws: SocketLike | null = null;
  /** True once `welcome` arrived on the current socket; nothing but `hello` is sent before. */
  private welcomed = false;
  private attempt = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private ping: ReturnType<typeof setInterval> | null = null;
  private done = false;
  /** Time of the last server message on the current socket (zombie-socket detection). */
  private lastRx = 0;
  private probe: ReturnType<typeof setTimeout> | null = null;
  private readonly msgs = new Emitter<ServerMessage>();
  private readonly statuses = new Emitter<ConnStatus>();

  constructor(
    readonly code: string,
    private readonly hello: () => HelloMessage,
    private readonly opts: SocketOptions = {},
  ) {
    window.addEventListener('online', this.wake);
    document.addEventListener('visibilitychange', this.wake);
    this.connect();
  }

  /** Dropped (false) until the server's `welcome` has arrived. */
  send(msg: ClientMessage): boolean {
    if (this.status !== 'open' || !this.welcomed || !this.ws || this.ws.readyState !== OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  onMessage(fn: (msg: ServerMessage) => void): () => void {
    return this.msgs.on(fn);
  }

  onStatus(fn: (status: ConnStatus) => void): () => void {
    return this.statuses.on(fn);
  }

  close(): void {
    this.terminate('user');
  }

  private terminate(reason: CloseReason): void {
    if (this.done) return;
    this.done = true;
    this.closeReason = reason;
    window.removeEventListener('online', this.wake);
    document.removeEventListener('visibilitychange', this.wake);
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.stopPing();
    this.clearProbe();
    const ws = this.ws;
    this.ws = null;
    this.welcomed = false;
    ws?.close();
    this.setStatus('closed');
  }

  private url(): string {
    if (this.opts.url) return this.opts.url;
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${window.location.host}/ws/${encodeURIComponent(this.code)}`;
  }

  private connect(): void {
    const Impl = this.opts.WebSocketImpl ?? (WebSocket as unknown as new (url: string) => SocketLike);
    const ws = new Impl(this.url());
    this.ws = ws;
    this.welcomed = false;
    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify(this.hello()));
    };
    ws.onmessage = ev => {
      if (this.ws !== ws) return;
      this.lastRx = Date.now();
      this.clearProbe();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === 'welcome' && !this.welcomed) {
        this.welcomed = true;
        this.attempt = 0;
        this.setStatus('open');
        this.stopPing();
        this.ping = setInterval(() => this.send({ t: 'ping' }), this.opts.pingMs ?? 20_000);
      }
      this.msgs.emit(msg);
      if (msg.t === 'error' && TERMINAL_ERRORS.has(msg.code)) this.terminate('rejected');
    };
    ws.onerror = () => {};
    ws.onclose = ev => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.welcomed = false;
      this.stopPing();
      this.clearProbe();
      if (this.done) return;
      const code = ev?.code;
      if (code !== undefined && FATAL_CLOSE_CODES.has(code)) {
        this.terminate(code === 4000 ? 'replaced' : 'protocol');
        return;
      }
      this.setStatus('reconnecting');
      this.scheduleRetry();
    };
  }

  private scheduleRetry(): void {
    const delay = backoffDelay(this.attempt);
    this.attempt += 1;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.tryConnect();
    }, delay);
  }

  /** connect() can throw (bad URL, blocked constructor); keep retrying instead of stalling. */
  private tryConnect(): void {
    try {
      this.connect();
    } catch {
      this.ws = null;
      this.scheduleRetry();
    }
  }

  /**
   * Back online / app visible again. While waiting out a backoff: retry now. While "open" but silent
   * for a while (iOS web clips silently kill sockets in the background): probe with a ping, and
   * reconnect at once if nothing comes back.
   */
  private readonly wake = (): void => {
    if (this.done || document.visibilityState === 'hidden') return;
    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
      this.attempt = 0;
      this.tryConnect();
      return;
    }
    if (this.status === 'open' && this.welcomed && !this.probe && Date.now() - this.lastRx > STALE_MS) {
      if (!this.send({ t: 'ping' })) return;
      this.probe = setTimeout(() => {
        this.probe = null;
        this.dropDeadSocket();
      }, PROBE_MS);
    }
  };

  private dropDeadSocket(): void {
    if (this.done) return;
    const ws = this.ws;
    this.ws = null;
    this.welcomed = false;
    this.stopPing();
    try {
      ws?.close();
    } catch {
      /* already dead */
    }
    this.attempt = 0;
    this.setStatus('reconnecting');
    this.tryConnect();
  }

  private clearProbe(): void {
    if (this.probe) clearTimeout(this.probe);
    this.probe = null;
  }

  private stopPing(): void {
    if (this.ping) clearInterval(this.ping);
    this.ping = null;
  }

  private setStatus(s: ConnStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.statuses.emit(s);
  }
}
