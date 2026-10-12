import type { HistoryResponse } from './protocol';
import { RoomApiError } from './httpService';

function isHistory(b: unknown): b is HistoryResponse {
  const o = b as Partial<HistoryResponse> | null;
  return !!o && typeof o === 'object' && Array.isArray(o.games) && Array.isArray(o.headToHead) && Array.isArray(o.leaderboard);
}

/** GET /api/history?player=<id> (spec §8). Errors are RoomApiError with a message safe to show. */
export async function fetchHistory(playerId: string, base = ''): Promise<HistoryResponse> {
  let res: Response;
  try {
    res = await fetch(`${base}/api/history?player=${encodeURIComponent(playerId)}`);
  } catch {
    throw new RoomApiError('Cannot reach the server. Check your connection.', 'network');
  }
  if (!res.ok) throw new RoomApiError(`Server error (HTTP ${res.status})`, 'server');
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!isHistory(body)) throw new RoomApiError('Unexpected response from the server.', 'badResponse');
  return body;
}
