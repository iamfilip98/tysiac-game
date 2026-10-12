import type { ClientMessage, CreateRoomRequest, ServerMessage } from './protocol';
import { Emitter, randomCode, type ConnStatus, type HelloMessage, type RoomConnection, type RoomService } from './connection';
import { LocalRoom, realClock, type Clock, type LocalSocket } from './localRoom';

export interface LocalOptions {
  botDelayScale?: number;
  latencyMs?: number;
  clock?: Clock;
}

/** All rooms of this tab (memory only — a reload forgets them). */
export class LocalHub {
  private readonly rooms = new Map<string, LocalRoom>();
  readonly latencyMs: number;
  constructor(private readonly opts: LocalOptions = {}) {
    this.latencyMs = opts.latencyMs ?? 0;
  }

  create(req: CreateRoomRequest): string {
    let code = randomCode();
    while (this.rooms.has(code)) code = randomCode();
    this.rooms.set(code, new LocalRoom({
      code,
      maxPlayers: req.maxPlayers,
      host: { playerId: req.playerId, name: req.name, avatar: req.avatar },
      seed: `${code}:${Date.now()}`,
      clock: this.opts.clock ?? realClock,
      botDelayScale: this.opts.botDelayScale,
    }));
    return code;
  }

  get(code: string): LocalRoom | undefined {
    return this.rooms.get(code);
  }
}

export class LocalConnection implements RoomConnection {
  status: ConnStatus = 'connecting';
  private sock: LocalSocket | null = null;
  private userClosed = false;
  private readonly msgs = new Emitter<ServerMessage>();
  private readonly statuses = new Emitter<ConnStatus>();

  constructor(readonly code: string, hub: LocalHub, hello: () => HelloMessage, private readonly latencyMs = 0) {
    setTimeout(() => {
      if (this.userClosed) return;
      const room = hub.get(code);
      if (!room) {
        this.msgs.emit({ t: 'error', code: 'notInRoom', message: 'That room does not exist' });
        this.setStatus('closed');
        return;
      }
      this.sock = room.open(
        msg => setTimeout(() => !this.userClosed && this.msgs.emit(msg), this.latencyMs),
        () => {
          this.sock = null;
          setTimeout(() => this.setStatus('closed'), this.latencyMs);
        },
      );
      this.setStatus('open');
      this.sock.send(hello());
    }, 0);
  }

  send(msg: ClientMessage): boolean {
    const sock = this.sock;
    if (this.status !== 'open' || !sock) return false;
    if (this.latencyMs === 0) sock.send(msg);
    else setTimeout(() => sock.send(msg), this.latencyMs);
    return true;
  }

  onMessage(fn: (msg: ServerMessage) => void): () => void {
    return this.msgs.on(fn);
  }

  onStatus(fn: (status: ConnStatus) => void): () => void {
    return this.statuses.on(fn);
  }

  close(): void {
    this.userClosed = true;
    this.sock?.close();
    this.sock = null;
    this.setStatus('closed');
  }

  private setStatus(s: ConnStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.statuses.emit(s);
  }
}

export function localService(hub: LocalHub = new LocalHub()): RoomService {
  return {
    kind: 'local',
    createRoom: async req => ({ code: hub.create(req) }),
    roomExists: async code => hub.get(code)?.exists() ?? { exists: false },
    connect: (code, hello) => new LocalConnection(code, hub, hello, hub.latencyMs),
  };
}
