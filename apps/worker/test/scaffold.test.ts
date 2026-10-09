import { env, exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

const worker = exports.default as unknown as Fetcher;

describe('worker scaffold', () => {
  it('answers unknown API routes with a JSON 404', async () => {
    const res = await worker.fetch('https://tysiac.test/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not found' });
  });

  it('has the D1 history tables', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('players', 'games', 'game_players') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(['game_players', 'games', 'players']);
  });

  it('binds the room namespace and test vars', () => {
    expect(env.DEBUG_KEY).toBe('test-debug-key');
    expect(env.BOT_DELAY_SCALE).toBe('0.1');
    expect(typeof env.ROOMS.idFromName).toBe('function');
  });
});
