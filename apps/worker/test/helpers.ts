import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import type { GameState } from '@tysiac/engine';
import type { CreateRoomResponse } from '@tysiac/protocol';
import type { Room } from '../src/room/Room';
import { RoomStore } from '../src/room/storage';
import type { DebugDump, RoomMeta } from '../src/room/types';
import { roomStub } from '../src/rooms';
import type { Schedule } from '../src/scheduler';

export const DEBUG_KEY = 'test-debug-key';

const worker = exports.default as unknown as Fetcher;

export function call(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(`https://tysiac.test${path}`, init);
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface Ident {
  playerId: string;
  secret: string;
  name: string;
  avatar: string;
}

let counter = 0;
export function ident(name: string): Ident {
  counter += 1;
  return { playerId: `${name.toLowerCase()}-${counter}-${crypto.randomUUID().slice(0, 8)}`, secret: crypto.randomUUID(), name, avatar: '🙂' };
}

export async function createRoom(host: Ident, maxPlayers: 3 | 4 = 3): Promise<string> {
  const res = await call('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ maxPlayers, playerId: host.playerId, name: host.name, avatar: host.avatar }),
  });
  if (res.status !== 200) throw new Error(`createRoom failed: ${res.status} ${await res.text()}`);
  return (await res.json<CreateRoomResponse>()).code;
}

export const stubFor = (code: string) => roomStub(env, code);

export async function debugDump(code: string): Promise<DebugDump> {
  const res = await call(`/api/debug/rooms/${code}`, { headers: { 'x-debug-key': DEBUG_KEY } });
  if (res.status !== 200) throw new Error(`debug dump failed: ${res.status}`);
  return res.json<DebugDump>();
}

/** Edits a room's stored meta/state/schedule (e.g. to fake time passing) and makes the live Room reload it. */
export async function patchRoom(
  code: string,
  patch: (data: { meta: RoomMeta; state: GameState | null; schedule: Schedule }) => void,
): Promise<void> {
  await runInDurableObject(stubFor(code), (room: Room, ctx) => {
    const store = new RoomStore(ctx.storage.sql);
    const data = { meta: store.getMeta()!, state: store.getState(), schedule: store.getSchedule() };
    patch(data);
    store.putMeta(data.meta);
    if (data.state) store.putState(data.state);
    store.putSchedule(data.schedule);
    room.load();
  });
}
