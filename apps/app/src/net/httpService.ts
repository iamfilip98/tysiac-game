import type { CreateRoomResponse, RoomExistsResponse } from './protocol';
import type { RoomService } from './connection';
import { SocketConnection } from './socket';

export function httpService(base = ''): RoomService {
  return {
    kind: 'remote',
    async createRoom(req) {
      const res = await fetch(`${base}/api/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<CreateRoomResponse> & { error?: string };
      if (!res.ok || typeof body.code !== 'string') throw new Error(body.error ?? `HTTP ${res.status}`);
      return { code: body.code };
    },
    async roomExists(code) {
      const res = await fetch(`${base}/api/rooms/${encodeURIComponent(code)}`);
      if (res.status === 404) return { exists: false };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as RoomExistsResponse;
    },
    connect: (code, hello) => new SocketConnection(code, hello),
  };
}
