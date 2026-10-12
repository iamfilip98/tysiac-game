import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHistory } from './history';

const ok = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
afterEach(() => vi.unstubAllGlobals());

describe('fetchHistory', () => {
  it('GETs /api/history with the encoded player id', async () => {
    const f = ok({ games: [], headToHead: [], leaderboard: [] });
    vi.stubGlobal('fetch', f);
    await expect(fetchHistory('a b/c')).resolves.toEqual({ games: [], headToHead: [], leaderboard: [] });
    expect(f).toHaveBeenCalledWith('/api/history?player=a%20b%2Fc', expect.anything());
  });
  it('network failure → kind network', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(fetchHistory('p')).rejects.toMatchObject({ kind: 'network', message: "Can't reach the server" });
  });
  it('a hung request is aborted after 10 s → kind network', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => new Promise((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      })));
      const p = expect(fetchHistory('p')).rejects.toMatchObject({ kind: 'network', message: "Can't reach the server" });
      await vi.advanceTimersByTimeAsync(10_000);
      await p;
    } finally {
      vi.useRealTimers();
    }
  });
  it('HTTP 500 → kind server', async () => {
    vi.stubGlobal('fetch', ok({ error: 'Internal error' }, 500));
    await expect(fetchHistory('p')).rejects.toMatchObject({ kind: 'server', message: 'Server error (HTTP 500)' });
  });
  it('a malformed body → kind badResponse', async () => {
    vi.stubGlobal('fetch', ok({ games: 'nope' }));
    await expect(fetchHistory('p')).rejects.toMatchObject({ kind: 'badResponse' });
  });
});
