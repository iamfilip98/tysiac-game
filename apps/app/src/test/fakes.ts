import { Emitter, type ConnStatus, type RoomConnection } from '../net/connection';
import type { ClientMessage, ServerMessage } from '../net/protocol';

export type ActMessage = Extract<ClientMessage, { t: 'act' }>;

export class FakeConnection implements RoomConnection {
  readonly code = 'ABCDEF';
  status: ConnStatus = 'open';
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
