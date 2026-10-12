import { Emitter, type CloseReason, type ConnStatus, type HelloMessage, type RoomConnection, type RoomService } from '../net/connection';
import type { ClientMessage, CreateRoomRequest, CreateRoomResponse, RoomExistsResponse, ServerMessage } from '../net/protocol';

export type ActMessage = Extract<ClientMessage, { t: 'act' }>;

export class FakeConnection implements RoomConnection {
  readonly code = 'ABCDEF';
  status: ConnStatus = 'open';
  closeReason?: CloseReason;
  sent: ClientMessage[] = [];
  /** Set false to simulate being offline (send returns false). */
  accept = true;
  private readonly msgs = new Emitter<ServerMessage>();
  private readonly statuses = new Emitter<ConnStatus>();

  send(msg: ClientMessage): boolean {
    if (!this.accept) return false;
    this.sent.push(msg);
    return true;
  }
  onMessage(fn: (msg: ServerMessage) => void): () => void {
    return this.msgs.on(fn);
  }
  onStatus(fn: (s: ConnStatus) => void): () => void {
    return this.statuses.on(fn);
  }
  close(): void {
    this.setStatus('closed');
  }
  push(msg: ServerMessage): void {
    this.msgs.emit(msg);
  }
  setStatus(s: ConnStatus): void {
    this.status = s;
    this.statuses.emit(s);
  }
  acts(): ActMessage[] {
    return this.sent.filter((m): m is ActMessage => m.t === 'act');
  }
}

export class FakeService implements RoomService {
  readonly kind = 'local' as const;
  created: CreateRoomRequest[] = [];
  conns: FakeConnection[] = [];
  hellos: (() => HelloMessage)[] = [];
  exists: Record<string, RoomExistsResponse> = { K7QX2M: { exists: true, status: 'lobby', maxPlayers: 3, seatsTaken: 1 } };

  async createRoom(req: CreateRoomRequest): Promise<CreateRoomResponse> {
    this.created.push(req);
    return { code: 'K7QX2M' };
  }
  async roomExists(code: string): Promise<RoomExistsResponse> {
    return this.exists[code] ?? { exists: false };
  }
  connect(_code: string, hello: () => HelloMessage): FakeConnection {
    const conn = new FakeConnection();
    this.conns.push(conn);
    this.hellos.push(hello);
    return conn;
  }
}
