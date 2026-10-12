import { botAction, makeRandom } from '@tysiac/engine';
import type { Action, PlayerView } from '@tysiac/engine';
import { PROTOCOL_VERSION } from '@tysiac/protocol';
import type { ClientMessage, RoomInfo, ServerMessage } from '@tysiac/protocol';
import { call, createRoom, ident, type Ident } from './helpers';

export type Msg<T extends ServerMessage['t']> = Extract<ServerMessage, { t: T }>;

export const isMove = (a: Action): boolean => a.type !== 'pause' && a.type !== 'resume';

export function firstMove(view: PlayerView): Action {
  const move = view.legal.find(isMove);
  if (!move) throw new Error(`${view.me} has no move`);
  return move;
}

/** A test-side WebSocket client: buffers every server message; `next` consumes the first match. */
export class Client {
  readonly inbox: ServerMessage[] = [];
  room: RoomInfo | null = null;
  view: PlayerView | null = null;
  closeCode: number | null = null;
  /** When true, plays a bot move (engine botAction) whenever a state says it is this player's turn. */
  autoplay = false;
  private lastPlayedSeq = -1;
  private readonly rand = makeRandom('autoplay');
  private wake: (() => void) | null = null;

  constructor(readonly ws: WebSocket, readonly who: Ident) {
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data as string) as ServerMessage;
      this.inbox.push(msg);
      if (msg.t === 'welcome' || msg.t === 'room') this.room = msg.room;
      if (msg.t === 'state') {
        this.view = msg.view;
        if (this.autoplay) this.playIfMyTurn();
      }
      this.wake?.();
    });
    ws.addEventListener('close', (event) => {
      this.closeCode = event.code;
      this.wake?.();
    });
  }

  get id(): string {
    return this.who.playerId;
  }

  send(msg: ClientMessage | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  sendRaw(text: string): void {
    this.ws.send(text);
  }

  act(action: Action): string {
    const id = crypto.randomUUID();
    this.send({ t: 'act', id, action });
    return id;
  }

  close(): void {
    this.ws.close(1000, 'test');
  }

  async next<T extends ServerMessage['t']>(t: T, pred: (m: Msg<T>) => boolean = () => true, timeoutMs = 5000): Promise<Msg<T>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = this.inbox.findIndex((m) => m.t === t && pred(m as Msg<T>));
      if (i >= 0) return this.inbox.splice(i, 1)[0] as Msg<T>;
      if (Date.now() > deadline) {
        throw new Error(`${this.who.name} timed out waiting for "${t}"; inbox: ${this.inbox.map((m) => m.t).join(',')}`);
      }
      await this.idle(50);
    }
  }

  async closed(timeoutMs = 3000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    while (this.closeCode === null) {
      if (Date.now() > deadline) throw new Error(`${this.who.name}: socket did not close`);
      await this.idle(50);
    }
    return this.closeCode;
  }

  playIfMyTurn(): void {
    const view = this.view;
    if (!view || view.paused || !(view.turn === view.me || view.legal.some((a) => a.type === 'ackTalon')) || view.seq <= this.lastPlayedSeq) return;
    if (!view.legal.some(isMove)) return;
    this.lastPlayedSeq = view.seq;
    this.act(botAction(view, this.rand));
  }

  private idle(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wake = null;
        resolve();
      }, ms);
      this.wake = () => {
        clearTimeout(timer);
        this.wake = null;
        resolve();
      };
    });
  }
}

export function helloMsg(who: Ident, coach = false): ClientMessage {
  return { t: 'hello', v: PROTOCOL_VERSION, playerId: who.playerId, secret: who.secret, name: who.name, avatar: who.avatar, coach };
}

export async function connect(code: string, who: Ident): Promise<Client> {
  const res = await call(`/ws/${code}`, { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket;
  if (res.status !== 101 || !ws) throw new Error(`WebSocket upgrade failed with ${res.status}`);
  ws.accept();
  return new Client(ws, who);
}

export async function join(code: string, who: Ident, coach = false): Promise<Client> {
  const client = await connect(code, who);
  client.send(helloMsg(who, coach));
  await client.next('welcome');
  return client;
}

export interface Table {
  code: string;
  host: Client;
  clients: Client[];
}

/** Creates a room (first human is host), seats everyone, adds bots and (unless start === false) starts. */
export async function setupTable(opts: { humans: string[]; bots?: number; maxPlayers?: 3 | 4; start?: boolean }): Promise<Table> {
  const people = opts.humans.map((name) => ident(name));
  const code = await createRoom(people[0], opts.maxPlayers ?? 3);
  const clients: Client[] = [];
  for (const who of people) clients.push(await join(code, who));
  const host = clients[0];
  for (let i = 1; i <= (opts.bots ?? 0); i++) {
    host.send({ t: 'lobby', op: { op: 'addBot' } });
    await host.next('room', (m) => m.room.seats.filter((s) => s?.isBot).length === i);
  }
  if (opts.start !== false) {
    host.send({ t: 'lobby', op: { op: 'start' } });
    for (const c of clients) await c.next('state');
  }
  return { code, host, clients };
}
