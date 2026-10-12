import type { HistoryResponse } from './protocol';
import { RoomApiError } from './httpService';

function isHistory(b: unknown): b is HistoryResponse {
  const o = b as Partial<HistoryResponse> | null;
  return !!o && typeof o === 'object' && Array.isArray(o.games) && Array.isArray(o.headToHead) && Array.isArray(o.leaderboard);
}

export const HISTORY_TIMEOUT_MS = 10_000;

/** GET /api/history?player=<id> (spec §8). Errors are RoomApiError with a message safe to show. */
export async function fetchHistory(playerId: string, base = ''): Promise<HistoryResponse> {
  let res: Response;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HISTORY_TIMEOUT_MS);
  try {
    res = await fetch(`${base}/api/history?player=${encodeURIComponent(playerId)}`, { signal: ctl.signal });
  } catch {
    throw new RoomApiError("Can't reach the server", 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new RoomApiError(`Server error (HTTP ${res.status})`, 'server', res.status);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!isHistory(body)) throw new RoomApiError('Unexpected response from the server.', 'badResponse');
  return body;
}
