import type { Room } from './room/Room';

/** One Durable Object per room code. */
export function roomStub(env: Env, code: string): DurableObjectStub<Room> {
  return env.ROOMS.get(env.ROOMS.idFromName(code));
}
