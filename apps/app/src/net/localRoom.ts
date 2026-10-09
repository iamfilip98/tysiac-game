import {
  botAction, botShouldAct, createGame, eventsFor, makeRandom, reduce, turnOf, viewFor,
  type Action, type GameEvent, type GameState, type PlayerId,
} from '@tysiac/engine';
import {
  PROTOCOL_VERSION,
  type ClientMessage, type ErrorCode, type LobbyOp, type RoomExistsResponse, type RoomInfo, type RoomSeat, type ServerMessage,
} from './protocol';
import { AWAY_BOT_AFTER_MS, type HelloMessage } from './connection';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): () => void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

/** 32 hex chars of OS randomness, for a room's game seed. */
export function randomSeed(): string {
  return [...crypto.getRandomValues(new Uint32Array(4))].map(n => n.toString(16).padStart(8, '0')).join('');
}

export const BOT_NAMES = ['Bot Basia', 'Bot Zenek', 'Bot Halina'] as const;
export const BOT_AVATAR = '🤖';

export interface LocalRoomOptions {
  code: string;
  maxPlayers: 3 | 4;
  host: { playerId: PlayerId; name: string; avatar: string };
  seed: string;
  clock?: Clock;
  /** Multiplies bot thinking time (e2e uses 0.05). */
  botDelayScale?: number;
}

export type Deliver = (msg: ServerMessage) => void;
export interface LocalSocket {
  send(msg: ClientMessage): void;
  close(): void;
}

interface Sock {
  pid: PlayerId | null;
  open: boolean;
  deliver: Deliver;
  onClosed: () => void;
}

const human = (id: PlayerId, name: string, avatar: string, coach: boolean): RoomSeat => ({
  id, name, avatar, isBot: false, connected: true, awaySince: null, botFor: false, coach,
});

/** An in-browser room with the same lobby semantics as the Worker's Room Durable Object. */
export class LocalRoom {
  readonly code: string;
  private readonly info: RoomInfo;
  private readonly secrets = new Map<PlayerId, string>();
  private readonly socks = new Map<PlayerId, Sock>();
  private state: GameState | null = null;
  private readonly seed: string;
  private games = 0;
  private botCount = 0;
  private readonly clock: Clock;
  private readonly botScale: number;
  private readonly rng: () => number;
  private cancelBot: (() => void) | null = null;

  constructor(o: LocalRoomOptions) {
    this.code = o.code;
    this.seed = o.seed;
    this.clock = o.clock ?? realClock;
    this.botScale = o.botDelayScale ?? 1;
    this.rng = makeRandom(`${o.seed}:bots`);
    const seats: (RoomSeat | null)[] = Array.from({ length: o.maxPlayers }, () => null);
    seats[0] = { ...human(o.host.playerId, o.host.name, o.host.avatar, false), connected: false };
    this.info = { code: o.code, status: 'lobby', maxPlayers: o.maxPlayers, hostId: o.host.playerId, seats, firstDealer: 0 };
  }

  exists(): RoomExistsResponse {
    return { exists: true, status: this.info.status, maxPlayers: this.info.maxPlayers, seatsTaken: this.info.seats.filter(Boolean).length };
  }

  snapshot(): RoomInfo {
    return JSON.parse(JSON.stringify(this.info)) as RoomInfo;
  }

  open(deliver: Deliver, onClosed: () => void = () => {}): LocalSocket {
    const sock: Sock = { pid: null, open: true, deliver, onClosed };
    return { send: msg => this.receive(sock, msg), close: () => this.drop(sock) };
  }

  // ---------- connection ----------

  private receive(sock: Sock, m: ClientMessage): void {
    if (!sock.open) return;
    if (m.t === 'hello') return this.hello(sock, m);
    if (!sock.pid) return this.fatal(sock, 'badMessage', 'Say hello first');
    switch (m.t) {
      case 'act':
        return this.act(sock, m.id, m.action);
      case 'lobby':
        return this.lobby(sock, m.op);
      case 'botFor':
        return this.botFor(sock, m.playerId);
      case 'setCoach': {
        const seat = this.seatOf(sock.pid);
        if (seat) seat.coach = m.coach;
        return this.broadcastRoom();
      }
      case 'rematch':
        return this.rematch(sock);
      case 'leave':
        return this.leave(sock);
      case 'ping':
        return sock.deliver({ t: 'pong' });
    }
  }

  private hello(sock: Sock, m: HelloMessage): void {
    if (m.v !== PROTOCOL_VERSION) return this.fatal(sock, 'versionMismatch', 'Please reload the app');
    const known = this.secrets.get(m.playerId);
    if (known !== undefined && known !== m.secret) return this.fatal(sock, 'badSecret', 'That seat belongs to another device');
    let seat = this.seatOf(m.playerId);
    if (!seat) {
      if (this.info.status !== 'lobby') return this.fatal(sock, 'gameInProgress', 'This game has already started');
      const i = this.info.seats.indexOf(null);
      if (i < 0) return this.fatal(sock, 'roomFull', 'This room is full');
      seat = human(m.playerId, m.name, m.avatar, m.coach);
      this.info.seats[i] = seat;
    }
    this.secrets.set(m.playerId, m.secret);
    const prev = this.socks.get(m.playerId);
    if (prev && prev !== sock) {
      prev.open = false;
      prev.onClosed();
    }
    sock.pid = m.playerId;
    this.socks.set(m.playerId, sock);
    seat.connected = true;
    seat.awaySince = null;
    seat.coach = m.coach;
    if (this.info.status === 'lobby') {
      seat.name = m.name;
      seat.avatar = m.avatar;
    }
    const hadBot = seat.botFor;
    seat.botFor = false;
    this.setEngineBotFor(m.playerId, false);
    sock.deliver({ t: 'welcome', you: m.playerId, room: this.snapshot(), serverTime: this.clock.now() });
    if (this.state) sock.deliver({ t: 'state', seq: this.state.seq, view: viewFor(this.state, m.playerId), events: [] });
    this.broadcastRoom();
    if (hadBot) this.scheduleBot([]);
  }

  private drop(sock: Sock): void {
    if (!sock.open) return;
    sock.open = false;
    const pid = sock.pid;
    if (!pid || this.socks.get(pid) !== sock) return;
    this.socks.delete(pid);
    const seat = this.seatOf(pid);
    if (seat) {
      seat.connected = false;
      if (this.info.status !== 'lobby') seat.awaySince = this.clock.now();
    }
    this.broadcastRoom();
  }

  private fatal(sock: Sock, code: ErrorCode, message: string): void {
    sock.deliver({ t: 'error', code, message });
    if (sock.pid && this.socks.get(sock.pid) === sock) this.drop(sock);
    sock.open = false;
    sock.onClosed();
  }

  private err(sock: Sock, code: ErrorCode, message: string): void {
    sock.deliver({ t: 'error', code, message });
  }

  // ---------- lobby ----------

  private lobby(sock: Sock, op: LobbyOp): void {
    if (this.info.status !== 'lobby') return this.err(sock, 'gameInProgress', 'The game has started');
    const isHost = sock.pid === this.info.hostId;
    const seats = this.info.seats;
    const valid = (i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < seats.length;
    switch (op.op) {
      case 'addBot': {
        if (!isHost) return this.err(sock, 'notHost', 'Only the host can add bots');
        const i = seats.indexOf(null);
        if (i < 0) return this.err(sock, 'roomFull', 'No empty seat');
        const used = new Set(seats.map(s => s?.name));
        const name = BOT_NAMES.find(n => !used.has(n)) ?? `Bot ${i + 1}`;
        seats[i] = { id: `bot-${++this.botCount}`, name, avatar: BOT_AVATAR, isBot: true, connected: true, awaySince: null, botFor: false, coach: false };
        break;
      }
      case 'removeBot': {
        if (!isHost) return this.err(sock, 'notHost', 'Only the host can remove bots');
        const i = seats.findIndex(s => s?.id === op.playerId && s.isBot);
        if (i < 0) return this.err(sock, 'badMessage', 'No such bot');
        seats[i] = null;
        break;
      }
      case 'swapSeats': {
        if (!valid(op.a) || !valid(op.b)) return this.err(sock, 'badMessage', 'Bad seat');
        [seats[op.a], seats[op.b]] = [seats[op.b], seats[op.a]];
        break;
      }
      case 'setFirstDealer': {
        if (!isHost) return this.err(sock, 'notHost', 'Only the host picks the first dealer');
        if (!valid(op.seat)) return this.err(sock, 'badMessage', 'Bad seat');
        this.info.firstDealer = op.seat;
        break;
      }
      case 'start': {
        if (!isHost) return this.err(sock, 'notHost', 'Only the host can start');
        if (seats.some(s => s === null)) return this.err(sock, 'badMessage', 'Fill every seat first');
        return this.startGame();
      }
    }
    this.broadcastRoom();
  }

  private leave(sock: Sock): void {
    const pid = sock.pid!;
    if (this.info.status !== 'lobby') return this.err(sock, 'gameInProgress', 'You can only leave from the lobby');
    const i = this.info.seats.findIndex(s => s?.id === pid);
    if (i >= 0) this.info.seats[i] = null;
    this.secrets.delete(pid);
    this.socks.delete(pid);
    sock.open = false;
    if (pid === this.info.hostId) {
      const next = this.info.seats.find(s => s && !s.isBot);
      if (next) this.info.hostId = next.id;
    }
    this.broadcastRoom();
  }

  private rematch(sock: Sock): void {
    if (sock.pid !== this.info.hostId) return this.err(sock, 'notHost', 'Only the host can start a rematch');
    if (this.info.status !== 'finished') return this.err(sock, 'badMessage', 'The game is not over');
    this.info.firstDealer = (this.info.firstDealer + 1) % this.info.maxPlayers;
    this.startGame();
  }

  private botFor(sock: Sock, target: PlayerId): void {
    const seat = this.seatOf(target);
    if (!seat || seat.isBot || this.info.status !== 'playing') return this.err(sock, 'badMessage', 'Nobody to replace');
    if (seat.connected || seat.awaySince === null || this.clock.now() - seat.awaySince < AWAY_BOT_AFTER_MS) {
      return this.err(sock, 'badMessage', 'Wait 30 s before letting a bot play');
    }
    seat.botFor = true;
    this.setEngineBotFor(target, true);
    this.broadcastRoom();
    this.scheduleBot([]);
  }

  // ---------- game ----------

  private startGame(): void {
    const seats = this.info.seats as RoomSeat[];
    this.state = createGame({
      seed: `${this.seed}:${this.games++}`,
      seats: seats.map(s => ({ id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot })),
      maxPlayers: this.info.maxPlayers,
      firstDealer: this.info.firstDealer,
    });
    for (const s of seats) if (s.botFor) this.setEngineBotFor(s.id, true);
    this.info.status = 'playing';
    this.broadcastRoom();
    this.broadcastState([]);
    this.scheduleBot([]);
  }

  private act(sock: Sock, id: string, action: Action): void {
    if (!this.state || this.info.status !== 'playing') {
      return sock.deliver({ t: 'reject', id, code: 'notStarted', message: 'The game has not started' });
    }
    const r = reduce(this.state, sock.pid!, action, this.clock.now());
    if (!r.ok) return sock.deliver({ t: 'reject', id, code: r.error.code, message: r.error.message });
    this.commit(r.state, r.events);
    sock.deliver({ t: 'ack', id });
  }

  private commit(state: GameState, events: GameEvent[]): void {
    this.state = state;
    this.broadcastState(events);
    if (state.phase === 'gameEnd' && this.info.status === 'playing') {
      this.info.status = 'finished';
      this.broadcastRoom();
    }
    this.scheduleBot(events);
  }

  private scheduleBot(events: GameEvent[]): void {
    this.cancelBot?.();
    this.cancelBot = null;
    const s = this.state;
    if (!s || s.phase === 'gameEnd' || s.paused) return;
    const turn = turnOf(s);
    if (!turn || !this.botControlled(turn) || !botShouldAct(viewFor(s, turn))) return;
    let delay = 600 + Math.floor(this.rng() * 300);
    if (events.some(e => e.type === 'trickWon')) delay += 1100;
    if (events.some(e => e.type === 'roundScored' || e.type === 'threw')) delay += 1500;
    this.cancelBot = this.clock.setTimeout(() => {
      this.cancelBot = null;
      this.botMove(turn);
    }, delay * this.botScale);
  }

  private botMove(pid: PlayerId): void {
    const s = this.state;
    if (!s || s.paused || turnOf(s) !== pid || !this.botControlled(pid)) return;
    const view = viewFor(s, pid);
    if (!botShouldAct(view)) return;
    const r = reduce(s, pid, botAction(view, this.rng), this.clock.now());
    if (!r.ok) throw new Error(`LocalRoom: bot ${pid} chose an illegal move: ${r.error.message}`);
    this.commit(r.state, r.events);
  }

  private botControlled(pid: PlayerId): boolean {
    const seat = this.seatOf(pid);
    return !!seat && (seat.isBot || seat.botFor);
  }

  private setEngineBotFor(pid: PlayerId, on: boolean): void {
    const seat = this.state?.seats.find(x => x.id === pid);
    if (!seat) return;
    if (on) seat.botFor = 'bot';
    else delete seat.botFor;
  }

  // ---------- broadcast ----------

  private seatOf(pid: PlayerId): RoomSeat | undefined {
    return this.info.seats.find((s): s is RoomSeat => s?.id === pid);
  }

  private broadcastRoom(): void {
    const room = this.snapshot();
    for (const sock of this.socks.values()) if (sock.open) sock.deliver({ t: 'room', room });
  }

  private broadcastState(events: GameEvent[]): void {
    const s = this.state;
    if (!s) return;
    for (const [pid, sock] of this.socks) {
      if (sock.open) sock.deliver({ t: 'state', seq: s.seq, view: viewFor(s, pid), events: eventsFor(events, pid) });
    }
  }
}
