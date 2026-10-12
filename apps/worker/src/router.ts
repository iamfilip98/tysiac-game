import { CreateRoomRequestSchema, PlayerIdSchema } from '@tysiac/protocol';
import type { CreateRoomResponse, RoomExistsResponse } from '@tysiac/protocol';
import { generateRoomCode, normalizeRoomCode } from './codes';
import { handleDebug } from './debug';
import { getHistory } from './history';
import { json } from './http';
import { roomStub } from './rooms';

const MAX_BODY_BYTES = 4096;
const CODE_ATTEMPTS = 5;

const is = (parts: string[], ...want: string[]) => parts.length === want.length && want.every((w, i) => w === '*' || parts[i] === w);

/** Only /api/* and /ws/* reach the Worker (assets.run_worker_first); everything else is static. */
export async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const method = request.method;
  try {
    if (method === 'POST' && is(parts, 'api', 'rooms')) return await createRoom(request, env);
    if (method === 'GET' && is(parts, 'api', 'rooms', '*')) return await roomExists(parts[2], env);
    if (method === 'GET' && is(parts, 'ws', '*')) return await openSocket(request, parts[1], env);
    if (method === 'GET' && is(parts, 'api', 'history')) return await history(url, env);
    if (method === 'GET' && is(parts, 'api', 'debug', 'rooms', '*')) return await handleDebug(request, parts[3], env);
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    console.error('request failed', { path: url.pathname, error: String(err) });
    return json({ error: 'Internal error' }, 500);
  }
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }
  const parsed = CreateRoomRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'Invalid room request' }, 400);
  const { maxPlayers, playerId, name, avatar } = parsed.data;
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const created = await roomStub(env, code).init({ code, maxPlayers, hostId: playerId, name, avatar, now: Date.now() });
    if (created) return json({ code } satisfies CreateRoomResponse);
  }
  return json({ error: 'Could not allocate a room code' }, 503);
}

async function roomExists(rawCode: string, env: Env): Promise<Response> {
  const code = normalizeRoomCode(rawCode);
  if (!code) return json({ exists: false } satisfies RoomExistsResponse);
  return json(await roomStub(env, code).info());
}

async function openSocket(request: Request, rawCode: string, env: Env): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'Expected a WebSocket upgrade' }, 426);
  const code = normalizeRoomCode(rawCode);
  if (!code) return json({ error: 'Room not found' }, 404);
  return roomStub(env, code).fetch(request);
}

async function history(url: URL, env: Env): Promise<Response> {
  const parsed = PlayerIdSchema.safeParse(url.searchParams.get('player'));
  if (!parsed.success) return json({ error: 'Missing or invalid ?player=' }, 400);
  return json(await getHistory(env.DB, parsed.data));
}
