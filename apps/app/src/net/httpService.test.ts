import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpService } from './httpService';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('httpService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates rooms with POST /api/rooms', async () => {
    const fetchMock = vi.fn(async () => json(200, { code: 'K7QX2M' }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await httpService().createRoom({ maxPlayers: 4, playerId: 'p', name: 'Ola', avatar: '🦉' });
    expect(res).toEqual({ code: 'K7QX2M' });
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms', expect.objectContaining({ method: 'POST', body: JSON.stringify({ maxPlayers: 4, playerId: 'p', name: 'Ola', avatar: '🦉' }) }));
  });

  it('throws the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(400, { error: 'bad name' })));
    await expect(httpService().createRoom({ maxPlayers: 3, playerId: 'p', name: '', avatar: '🦉' })).rejects.toThrow('bad name');
  });

  it('checks rooms with GET /api/rooms/:code (404 → not found)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('AAAAAA') ? json(404, {}) : json(200, { exists: true, status: 'lobby', maxPlayers: 3, seatsTaken: 1 }))));
    expect(await httpService().roomExists('AAAAAA')).toEqual({ exists: false });
    expect(await httpService().roomExists('BBBBBB')).toEqual({ exists: true, status: 'lobby', maxPlayers: 3, seatsTaken: 1 });
  });
});
