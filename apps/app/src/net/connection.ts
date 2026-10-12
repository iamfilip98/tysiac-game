import type {
  ClientMessage, CreateRoomRequest, CreateRoomResponse, RoomExistsResponse, ServerMessage,
} from './protocol';

export type HelloMessage = Extract<ClientMessage, { t: 'hello' }>;
export type ConnStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';
/** Why a connection ended for good (status 'closed'); undefined while live or for LocalRoom. */
export type CloseReason = 'user' | 'replaced' | 'protocol' | 'rejected';

/** One live link to a room. SocketConnection talks to the Worker; LocalConnection to an in-browser LocalRoom. */
export interface RoomConnection {
  readonly code: string;
  readonly status: ConnStatus;
  readonly closeReason?: CloseReason;
  /** Returns false (and drops the message) when the link is not open. */
  send(msg: ClientMessage): boolean;
  onMessage(fn: (msg: ServerMessage) => void): () => void;
  onStatus(fn: (status: ConnStatus) => void): () => void;
  close(): void;
}

export interface RoomService {
  readonly kind: 'local' | 'remote';
  createRoom(req: CreateRoomRequest): Promise<CreateRoomResponse>;
  roomExists(code: string): Promise<RoomExistsResponse>;
  connect(code: string, hello: () => HelloMessage): RoomConnection;
}

export class Emitter<T> {
  private readonly fns = new Set<(value: T) => void>();
  on(fn: (value: T) => void): () => void {
    this.fns.add(fn);
    return () => {
      this.fns.delete(fn);
    };
  }
  emit(value: T): void {
    for (const fn of [...this.fns]) fn(value);
  }
}

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{6}$`);

export function normalizeCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** A disconnected player's seat may be handed to a bot after this long. */
export const AWAY_BOT_AFTER_MS = 30_000;

/** Errors after which reconnecting cannot help. */
export const FATAL_ERRORS: ReadonlySet<string> = new Set(['roomFull', 'badSecret', 'gameInProgress', 'versionMismatch', 'notInRoom']);
