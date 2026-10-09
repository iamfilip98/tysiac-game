import { DurableObject } from 'cloudflare:workers';
import type { GameState, PlayerId } from '@tysiac/engine';
import type { RoomExistsResponse } from '@tysiac/protocol';
import { CLEANUP_AFTER_MS, nextAlarmAt, type Schedule } from '../scheduler';
import * as lobby from './lobby';
import { RoomStore } from './storage';
import type { DebugDump, InitRoomRequest, RoomMeta, SocketAttachment } from './types';

const EMPTY_SCHEDULE: Schedule = { bot: null, cleanup: 0 };

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

  async alarm(): Promise<void> {
    if (!this.meta) return;
    const now = Date.now();
    if (now >= this.schedule.cleanup) return this.destroy();
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
  }

  // ---------- internals ----------

  private setMeta(meta: RoomMeta): void {
    this.meta = meta;
    this.store.putMeta(meta);
  }

  /** Activity: cleanup moves to now + 7 days; the single alarm is re-armed. */
  private async reschedule(now: number): Promise<void> {
    this.schedule = { bot: null, cleanup: now + CLEANUP_AFTER_MS };
    this.store.putSchedule(this.schedule);
    await this.ctx.storage.setAlarm(nextAlarmAt(this.schedule));
  }

  private async destroy(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1001, 'room expired');
      } catch {
        // already closed
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    this.state = null;
    this.schedule = EMPTY_SCHEDULE;
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
}
