import type { CreateRoomResponse, RoomExistsResponse } from './protocol';
import type { RoomService } from './connection';
import { SocketConnection } from './socket';

/** Thrown for any failed room API call; `message` is safe to show to the player. */
export class RoomApiError extends Error {
  constructor(message: string, readonly kind: 'network' | 'server' | 'badResponse') {
    super(message);
    this.name = 'RoomApiError';
  }
}

async function call(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new RoomApiError('Cannot reach the server. Check your connection.', 'network');
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export function httpService(base = ''): RoomService {
  return {
    kind: 'remote',
    async createRoom(req) {
      const res = await call(`${base}/api/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      const body = (await readJson(res)) as (Partial<CreateRoomResponse> & { error?: unknown }) | undefined;
      if (!res.ok) {
        throw new RoomApiError(typeof body?.error === 'string' ? body.error : `Server error (HTTP ${res.status})`, 'server');
      }
      if (typeof body?.code !== 'string') throw new RoomApiError('Unexpected response from the server.', 'badResponse');
      return { code: body.code };
    },
    async roomExists(code) {
      const res = await call(`${base}/api/rooms/${encodeURIComponent(code)}`);
      if (res.status === 404) return { exists: false };
      if (!res.ok) throw new RoomApiError(`Server error (HTTP ${res.status})`, 'server');
      const body = (await readJson(res)) as RoomExistsResponse | undefined;
      if (!body || typeof body !== 'object' || typeof body.exists !== 'boolean') {
        throw new RoomApiError('Unexpected response from the server.', 'badResponse');
      }
      return body;
    },
    connect: (code, hello) => new SocketConnection(code, hello),
  };
}
