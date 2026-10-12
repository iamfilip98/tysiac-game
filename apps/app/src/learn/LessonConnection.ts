import { actionsEqual, type Action, type PlayerView } from '@tysiac/engine';
import type { ClientMessage, ServerMessage } from '../net/protocol';
import { Emitter, type CloseReason, type ConnStatus, type RoomConnection } from '../net/connection';

export interface LessonRules {
  /** The learner's scripted action at this server seq, or null. */
  expectedAt(seq: number): Action | null;
  /** The friendly line shown when the learner tries something else. */
  hint(view: PlayerView | null, expected: Action | null, tried: Action): string;
}

/** Forwards everything except engine actions that are not the lesson's next move; those get a local reject. */
export class LessonConnection implements RoomConnection {
  private seq = -1;
  private view: PlayerView | null = null;
  private readonly msgs = new Emitter<ServerMessage>();
  private readonly offInner: () => void;

  constructor(private readonly inner: RoomConnection, private readonly rules: LessonRules) {
    this.offInner = inner.onMessage(m => {
      if (m.t === 'state') {
        this.seq = m.seq;
        this.view = m.view;
      }
      this.msgs.emit(m);
    });
  }

  get code(): string {
    return this.inner.code;
  }
  get status(): ConnStatus {
    return this.inner.status;
  }
  get closeReason(): CloseReason | undefined {
    return this.inner.closeReason;
  }

  send(msg: ClientMessage): boolean {
    if (msg.t !== 'act') return this.inner.send(msg);
    if (this.inner.status !== 'open') return false;
    const expected = this.rules.expectedAt(this.seq);
    if (expected && actionsEqual(expected, msg.action)) return this.inner.send(msg);
    const message = this.rules.hint(this.view, expected, msg.action);
    setTimeout(() => this.msgs.emit({ t: 'reject', id: msg.id, code: 'lesson', message }), 0);
    return true;
  }

  onMessage(fn: (msg: ServerMessage) => void): () => void {
    return this.msgs.on(fn);
  }
  onStatus(fn: (status: ConnStatus) => void): () => void {
    return this.inner.onStatus(fn);
  }
  close(): void {
    this.offInner();
    this.inner.close();
  }
}
