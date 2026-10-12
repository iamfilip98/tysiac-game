import { normalizeRoomCode } from './codes';
import { json } from './http';
import { safeEqual } from './identity';
import { roomStub } from './rooms';

/** GET /api/debug/rooms/:code with header x-debug-key = DEBUG_KEY → room meta, state, action log, schedule. */
export async function handleDebug(request: Request, rawCode: string, env: Env): Promise<Response> {
  const key = request.headers.get('x-debug-key') ?? '';
  if (!env.DEBUG_KEY || !safeEqual(key, env.DEBUG_KEY)) return json({ error: 'Not found' }, 404);
  const code = normalizeRoomCode(rawCode);
  if (!code) return json({ error: 'Room not found' }, 404);
  const dump = await roomStub(env, code).debugDump();
  return dump ? json(dump) : json({ error: 'Room not found' }, 404);
}
