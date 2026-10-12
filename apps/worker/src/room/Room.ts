import { DurableObject } from 'cloudflare:workers';
import { createGame, eventsFor, reduce, viewFor } from '@tysiac/engine';
import type { Action, GameEvent, GameState, PlayerId } from '@tysiac/engine';
import { parseClientMessage } from '@tysiac/protocol';
import type { ClientMessage, ErrorCode, LobbyOp, ParseResult, RoomExistsResponse, RoomInfo, ServerMessage } from '@tysiac/protocol';
import { randomHex, sha256Hex } from '../identity';
import { checkRate, newBucket, type RateBucket } from '../ratelimit';
import { CLEANUP_AFTER_MS, botDelayMs, nextAlarmAt, parseScale, type Schedule } from '../scheduler';
import { botActor, chooseBotAction } from './bots';
import * as lobby from './lobby';
import { RoomStore } from './storage';
import type { DebugDump, GameOptions, InitRoomRequest, RoomMeta, SocketAttachment } from './types';

type Hello = Extract<ClientMessage, { t: 'hello' }>;

const EMPTY_SCHEDULE: Schedule = { bot: null, cleanup: 0 };
const BOT_RETRY_MS = 1000;
/** After a bot move failed twice at the same state, the alarm keeps trying at this slower pace. */
const BOT_GIVE_UP_RETRY_MS = 30_000;

/** Which player a socket speaks for (null until its hello is accepted). Survives hibernation. */
export function attachmentOf(ws: WebSocket): SocketAttachment {
  return (ws.deserializeAttachment() as SocketAttachment | null) ?? { playerId: null };
}

/**
 * One Durable Object per room code (SQLite-backed). Uses the WebSocket Hibernation API only; identity
 * lives in socket attachments, everything else in SQLite; a single alarm drives bots and cleanup.
 */
export class Room extends DurableObject<Env> {
  private readonly store: RoomStore;
  private meta: RoomMeta | null = null;
  private state: GameState | null = null;
  private schedule: Schedule = EMPTY_SCHEDULE;
  /** In-memory: the state seq whose bot move already failed once (1 s retry, then every 30 s until a message re-plans). */
  private botFailedAtSeq: number | null = null;
  /** In-memory only: a hibernation simply resets the windows. */
  private readonly buckets = new WeakMap<WebSocket, RateBucket>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.store = new RoomStore(ctx.storage.sql);
    // Exact-match pings are answered by the runtime without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    this.load();
  }

  /** (Re)reads the room from SQLite: on construction (after hibernation, eviction, redeploy) and after test patches. */
  load(): void {
    if (!this.store.exists()) {
      this.meta = null;
      this.state = null;
      this.schedule = EMPTY_SCHEDULE;
      return;
    }
    this.meta = this.store.getMeta();
    this.state = this.store.getState();
    this.schedule = this.store.getSchedule();
  }

  // ---------- RPC from the Worker ----------

  async init(req: InitRoomRequest): Promise<boolean> {
    if (this.meta) return false;
    this.store.create();
    this.setMeta(lobby.createMeta(req));
    await this.reschedule(req.now);
    return true;
  }

  async info(): Promise<RoomExistsResponse> {
    const meta = this.meta;
    if (!meta) return { exists: false };
    return { exists: true, status: meta.status, maxPlayers: meta.maxPlayers, seatsTaken: meta.seats.filter((s) => s !== null).length };
  }

  async debugDump(): Promise<DebugDump | null> {
    const meta = this.meta;
    if (!meta) return null;
    return {
      meta: { ...meta, seats: meta.seats.map((s) => s && lobby.publicSeat(s)) },
      state: this.state,
      gameOptions: this.store.getGameOptions(),
      log: this.store.readLog(),
      schedule: this.schedule,
      connected: [...this.connectedIds()],
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }
    if (!this.meta) return new Response('Room not found', { status: 404 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ playerId: null } satisfies SocketAttachment);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** The single alarm: room cleanup, or a due bot move. Never throws (a throw would make the runtime retry it). */
  async alarm(): Promise<void> {
    try {
      if (!this.meta) return;
      const now = Date.now();
      if (now >= this.schedule.cleanup) return await this.destroy();
      this.sweepPresence(now);
      if (this.syncBotFlags()) this.broadcastState([]);
      if (this.schedule.bot !== null && now >= this.schedule.bot) {
        const ok = await this.playBot(now); // on success commit() has already re-planned
        if (!ok) await this.afterBotFailure(now);
        else await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule)); // no-op unless the move was skipped
      } else {
        await this.reschedule(now, null, { touch: false }); // the sweep or a flag sync may have changed who must act
      }
    } catch (err) {
      console.error('room alarm failed', err instanceof Error ? err.message : 'unknown error');
      try {
        await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
      } catch {
        // nothing more to do; the next socket message re-arms the alarm
      }
    }
  }

  // ---------- sockets ----------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      await this.handleMessage(ws, message);
    } catch (err) {
      // Never log message contents (they can carry secrets).
      console.error('room message handler failed', err instanceof Error ? err.message : 'unknown error');
      if (ws.readyState === WebSocket.READY_STATE_OPEN) {
        // A failed hello must not leave the socket locked out behind `pending`.
        if (attachmentOf(ws).pending) ws.serializeAttachment({ playerId: null } satisfies SocketAttachment);
        this.sendError(ws, 'badMessage', 'Something went wrong handling that message');
      }
    }
  }

  private async handleMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const now = Date.now();
    this.sweepPresence(now); // a wake after eviction or redeploy: nobody's close handler ran
    let bucket = this.buckets.get(ws);
    if (!bucket) {
      bucket = newBucket(now);
      this.buckets.set(ws, bucket);
    }
    const verdict = checkRate(bucket, now);
    if (verdict === 'drop') return;
    if (verdict === 'warn') return this.sendError(ws, 'rateLimited', 'Too many messages — slow down');
    await this.replanAfterBotFailure(now);

    const att = attachmentOf(ws);
    const me = att.playerId;
    if (att.pending) return this.sendError(ws, 'badMessage', 'Your hello is still being processed');
    const parsed: ParseResult =
      typeof message === 'string' ? parseClientMessage(message) : { ok: false, code: 'badMessage', message: 'Messages must be text' };
    if (!parsed.ok) {
      this.sendError(ws, parsed.code, parsed.message);
      if (me === null) this.safeClose(ws, 1008, parsed.code);
      return;
    }
    if (!this.meta) {
      this.sendError(ws, 'notInRoom', 'This room no longer exists');
      this.safeClose(ws, 1008, 'notInRoom');
      return;
    }
    // The client must await `welcome` before sending anything but hello: until then this socket has no identity.
    if (me === null) {
      if (parsed.msg.t !== 'hello') {
        this.sendError(ws, 'badMessage', 'The first message must be hello');
        this.safeClose(ws, 1008, 'badMessage');
        return;
      }
      return this.onHello(ws, parsed.msg, now);
    }
    return this.dispatch(ws, me, parsed.msg, now);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.onDisconnect(ws);
    this.safeClose(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.onDisconnect(ws);
  }

  private async onHello(ws: WebSocket, msg: Hello, now: number): Promise<void> {
    ws.serializeAttachment({ playerId: null, pending: true } satisfies SocketAttachment); // before any await
    const secretHash = await sha256Hex(msg.secret);
    const meta = this.meta; // read after the await: another hello may have taken a seat meanwhile
    // The socket may have closed (or been destroyed) while hashing; do not claim a seat for a dead socket.
    if (!meta || ws.readyState !== WebSocket.READY_STATE_OPEN || !attachmentOf(ws).pending) return;
    const claim = lobby.claimSeat(meta, { id: msg.playerId, name: msg.name, avatar: msg.avatar, coach: msg.coach, secretHash });
    if (!claim.ok) {
      ws.serializeAttachment({ playerId: null } satisfies SocketAttachment);
      this.sendError(ws, claim.code, claim.message);
      this.safeClose(ws, 1008, claim.code);
      return;
    }
    for (const old of this.socketsOf(msg.playerId, ws)) {
      old.serializeAttachment({ playerId: null } satisfies SocketAttachment); // its close must not mark the player away
      this.safeClose(old, 4000, 'replaced');
    }
    ws.serializeAttachment({ playerId: msg.playerId } satisfies SocketAttachment);
    this.setMeta(claim.meta);
    // Reclaim (spec §6): the player takes control back. The bot target is derived from meta, so a pending
    // bot move for this seat is dropped by reschedule().
    const flagsChanged = claim.tookBack && this.syncBotFlags();
    await this.reschedule(now);
    this.send(ws, { t: 'welcome', you: msg.playerId, room: this.roomInfo(), serverTime: now });
    if (this.state) this.send(ws, { t: 'state', seq: this.state.seq, view: viewFor(this.state, msg.playerId), events: [] });
    this.broadcastRoom({ skip: ws }); // the joiner already got `welcome`; others see it as connected
    if (flagsChanged) this.broadcastState([], ws);
  }

  private async dispatch(ws: WebSocket, me: PlayerId, msg: ClientMessage, now: number): Promise<void> {
    const meta = this.meta;
    if (!meta) return;
    switch (msg.t) {
      case 'hello':
        return this.sendError(ws, 'badMessage', 'You have already joined');
      case 'act':
        return this.onAct(ws, me, msg.id, msg.action, now);
      case 'lobby':
        return this.onLobby(ws, meta, me, msg.op, now);
      case 'setCoach':
        return this.applyLobby(ws, lobby.setCoach(meta, me, msg.coach), now);
      case 'leave':
        return this.onLeave(ws, meta, me, now);
      case 'ping':
        return this.send(ws, { t: 'pong' });
      case 'botFor':
        return this.onBotFor(ws, meta, me, msg.playerId, now);
      case 'rematch':
        return this.sendError(ws, 'badMessage', '"rematch" is not available yet');
    }
  }

  private async onAct(ws: WebSocket, me: PlayerId, id: string, action: Action, now: number): Promise<void> {
    if (!this.state) return this.send(ws, { t: 'reject', id, code: 'notPlaying', message: 'The game has not started yet' });
    const result = reduce(this.state, me, action, now);
    if (!result.ok) return this.send(ws, { t: 'reject', id, code: result.error.code, message: result.error.message });
    await this.commit(me, action, result.state, result.events, now);
    this.send(ws, { t: 'ack', id });
  }

  private async onLobby(ws: WebSocket, meta: RoomMeta, me: PlayerId, op: LobbyOp, now: number): Promise<void> {
    switch (op.op) {
      case 'addBot':
        return this.applyLobby(ws, lobby.addBot(meta, me, `bot-${randomHex(6)}`), now);
      case 'removeBot':
        return this.applyLobby(ws, lobby.removeBot(meta, me, op.playerId), now);
      case 'swapSeats':
        return this.applyLobby(ws, lobby.swapSeats(meta, me, op.a, op.b), now);
      case 'setFirstDealer':
        return this.applyLobby(ws, lobby.setFirstDealer(meta, me, op.seat), now);
      case 'start':
        return this.startGame(ws, lobby.start(meta, me, crypto.randomUUID(), now, this.connectedIds()), now);
    }
  }

  private async onBotFor(ws: WebSocket, meta: RoomMeta, me: PlayerId, target: PlayerId, now: number): Promise<void> {
    const result = lobby.setBotFor(meta, me, target, now);
    if (!result.ok) return this.sendError(ws, result.code, result.message);
    this.setMeta(result.meta);
    const flagsChanged = this.syncBotFlags();
    await this.reschedule(now);
    this.broadcastRoom();
    if (flagsChanged) this.broadcastState([]);
  }

  private async applyLobby(ws: WebSocket, result: lobby.LobbyResult, now: number): Promise<void> {
    if (!result.ok) return this.sendError(ws, result.code, result.message);
    this.setMeta(result.meta);
    await this.reschedule(now);
    this.broadcastRoom();
  }

  /** Shared by start and (Task 12) rematch: new seed, new GameState, fresh log. */
  private async startGame(ws: WebSocket, result: lobby.LobbyResult, now: number): Promise<void> {
    if (!result.ok) return this.sendError(ws, result.code, result.message);
    const options: GameOptions = {
      seed: randomHex(16),
      seats: lobby.engineSeats(result.meta),
      maxPlayers: result.meta.maxPlayers,
      firstDealer: result.meta.firstDealer,
    };
    let state: GameState;
    try {
      state = createGame(options);
    } catch (err) {
      return this.sendError(ws, 'badMessage', `Could not start the game: ${String(err)}`);
    }
    this.meta = result.meta;
    this.state = state;
    this.botFailedAtSeq = null;
    this.schedule = { bot: this.planBot(now, []), cleanup: now + CLEANUP_AFTER_MS };
    this.ctx.storage.transactionSync(() => {
      this.store.putMeta(result.meta);
      this.store.putState(state);
      this.store.putGameOptions(options);
      this.store.clearLog();
      this.store.putSchedule(this.schedule);
    });
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
    this.broadcastRoom();
    this.broadcastState([]);
  }

  private async onLeave(ws: WebSocket, meta: RoomMeta, me: PlayerId, now: number): Promise<void> {
    const result = lobby.leaveSeat(meta, me);
    if (!result.ok) return this.sendError(ws, result.code, result.message);
    ws.serializeAttachment({ playerId: null } satisfies SocketAttachment);
    this.setMeta(result.meta);
    await this.reschedule(now);
    this.broadcastRoom();
    this.safeClose(ws, 1000, 'left');
  }

  private onDisconnect(ws: WebSocket): void {
    const me = attachmentOf(ws).playerId;
    if (me === null || !this.meta) return;
    if (this.socketsOf(me, ws).length > 0) return; // another tab of the same player is still here
    const next = lobby.markAway(this.meta, me, Date.now());
    if (next !== this.meta) this.setMeta(next);
    this.broadcastRoom({ gone: ws });
  }

  /** Persist + broadcast one accepted engine action (human or bot), then plan the next bot move. */
  private async commit(by: PlayerId, action: Action, state: GameState, events: GameEvent[], now: number): Promise<void> {
    this.state = state;
    this.botFailedAtSeq = null;
    this.schedule = { bot: this.planBot(now, events), cleanup: now + CLEANUP_AFTER_MS };
    // State, log entry and schedule land atomically (no await between the writes).
    this.ctx.storage.transactionSync(() => {
      this.store.putState(state);
      this.store.appendLog({ seq: state.seq, at: now, player: by, action });
      this.store.putSchedule(this.schedule);
    });
    this.broadcastState(events);
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
  }

  /** Runs the due bot move. Returns false when it failed (nothing was committed). Never throws. */
  private async playBot(now: number): Promise<boolean> {
    this.schedule = { ...this.schedule, bot: null };
    this.store.putSchedule(this.schedule);
    if (!this.state || !this.meta) return true;
    const actor = botActor(this.state, this.meta);
    if (actor === null) return true; // paused, reclaimed, or finished since it was scheduled
    try {
      const action = chooseBotAction(this.state, actor, Math.random);
      const result = reduce(this.state, actor, action, now);
      if (!result.ok) {
        console.error('bot move rejected', { room: this.meta.code, actor, type: action.type, code: result.error.code });
        return false;
      }
      await this.commit(actor, action, result.state, result.events, now);
      return true;
    } catch (err) {
      console.error('bot move failed', { room: this.meta.code, actor, error: err instanceof Error ? err.message : 'unknown error' });
      return false;
    }
  }

  /** One retry 1 s later; after a second failure at the same state, keep retrying every 30 s (any message re-plans sooner). */
  private async afterBotFailure(now: number): Promise<void> {
    const seq = this.state?.seq ?? null;
    const firstFailure = this.botFailedAtSeq !== seq;
    this.botFailedAtSeq = seq;
    if (!firstFailure) console.error('bot move failed again; retrying slowly', { room: this.meta?.code, seq });
    this.schedule = { bot: now + (firstFailure ? BOT_RETRY_MS : BOT_GIVE_UP_RETRY_MS), cleanup: this.schedule.cleanup };
    this.store.putSchedule(this.schedule);
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
  }

  /** A stalled bot (failed move, waiting on a slow retry) gets a fresh plan as soon as anyone sends anything. */
  private async replanAfterBotFailure(now: number): Promise<void> {
    if (this.botFailedAtSeq === null) return;
    this.botFailedAtSeq = null;
    this.schedule = { ...this.schedule, bot: null };
    await this.reschedule(now, null, { touch: false });
  }

  /**
   * Mirrors SeatMeta.botFor into the engine seats (engine ignores it; views show it). Returns whether any
   * seat changed. Replay determinism: seat flags are an overlay that is NOT in the action log, and seq is not
   * bumped, so a replay (createGame(gameOptions) + log) equals the live state except for `seats[].botFor`.
   */
  private syncBotFlags(): boolean {
    if (!this.state || !this.meta) return false;
    const seats = lobby.withBotFlags(this.state.seats, this.meta);
    if (seats.every((s, i) => s.botFor === this.state!.seats[i]?.botFor)) return false;
    this.state = { ...this.state, seats };
    this.store.putState(this.state);
    return true;
  }

  /**
   * Presence sweep: after eviction or a redeploy no close handler ran, so a human seat with no live socket
   * and no awaySince gets awaySince = now (otherwise botFor could never become available).
   */
  private sweepPresence(now: number): void {
    const meta = this.meta;
    if (!meta || meta.status !== 'playing') return;
    const connected = this.connectedIds();
    let next = meta;
    for (const seat of meta.seats) {
      if (seat && !seat.isBot && seat.awaySince === null && !connected.has(seat.id)) next = lobby.markAway(next, seat.id, now);
    }
    if (next === meta) return;
    this.setMeta(next);
    this.broadcastRoom();
  }

  // ---------- internals ----------

  private setMeta(meta: RoomMeta): void {
    this.meta = meta;
    this.store.putMeta(meta);
  }

  /**
   * The one place the bot schedule is computed: a bot move is due iff botActor(state, meta) says a bot (or
   * bot-for) seat must act. `events` = what just happened (fresh delay, spec §6); null keeps an already
   * pending time (hello, lobby ops, botFor) but still drops it when nobody needs a bot any more.
   */
  private planBot(now: number, events: readonly GameEvent[] | null): number | null {
    const actor = this.state && this.meta ? botActor(this.state, this.meta) : null;
    if (actor === null) return null;
    if (events === null && this.schedule.bot !== null) return this.schedule.bot;
    return now + botDelayMs(events ?? [], Math.random, parseScale(this.env.BOT_DELAY_SCALE));
  }

  /** Re-plans the bot move and (unless `touch` is false) moves cleanup to now + 7 days; re-arms the alarm. */
  private async reschedule(now: number, events: readonly GameEvent[] | null = null, opts: { touch?: boolean } = {}): Promise<void> {
    const cleanup = opts.touch === false ? this.schedule.cleanup : now + CLEANUP_AFTER_MS;
    this.schedule = { bot: this.planBot(now, events), cleanup };
    this.store.putSchedule(this.schedule);
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
  }

  private async destroy(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.safeClose(ws, 1001, 'room expired');
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    this.state = null;
    this.schedule = EMPTY_SCHEDULE;
  }

  private socketsOf(playerId: PlayerId, exclude?: WebSocket): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== exclude && ws.readyState === WebSocket.READY_STATE_OPEN && attachmentOf(ws).playerId === playerId);
  }

  private connectedIds(exclude?: WebSocket): Set<PlayerId> {
    const ids = new Set<PlayerId>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || ws.readyState !== WebSocket.READY_STATE_OPEN) continue;
      const id = attachmentOf(ws).playerId;
      if (id !== null) ids.add(id);
    }
    return ids;
  }

  private roomInfo(exclude?: WebSocket): RoomInfo {
    return lobby.toRoomInfo(this.meta!, this.connectedIds(exclude));
  }

  /**
   * `room` to every joined socket. `skip` is a recipient to leave out (the joiner, who already has `welcome`);
   * `gone` is a socket to count as disconnected (and not send to). The two are independent.
   */
  private broadcastRoom(opts: { skip?: WebSocket; gone?: WebSocket } = {}): void {
    if (!this.meta) return;
    const room = this.roomInfo(opts.gone);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== opts.skip && ws !== opts.gone && attachmentOf(ws).playerId !== null) this.send(ws, { t: 'room', room });
    }
  }

  /** Personalised `state` (own view + events this player may see) to every joined socket. */
  private broadcastState(events: GameEvent[], skip?: WebSocket): void {
    const state = this.state;
    if (!state) return;
    for (const ws of this.ctx.getWebSockets()) {
      const id = attachmentOf(ws).playerId;
      if (id === null || ws === skip) continue;
      this.send(ws, { t: 'state', seq: state.seq, view: viewFor(state, id), events: eventsFor(events, id) });
    }
  }

  private safeClose(ws: WebSocket, code?: number, reason?: string): void {
    try {
      if (ws.readyState === WebSocket.READY_STATE_OPEN || ws.readyState === WebSocket.READY_STATE_CONNECTING) {
        if (code === undefined) ws.close();
        else ws.close(code, reason);
      }
    } catch {
      // already closing or closed
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket closed under us; its close handler deals with presence
    }
  }

  private sendError(ws: WebSocket, code: ErrorCode, message: string): void {
    this.send(ws, { t: 'error', code, message });
  }
}
