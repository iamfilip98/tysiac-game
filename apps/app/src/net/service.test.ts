import { afterEach, describe, expect, it } from 'vitest';
import { getService, isFastLocal, isLocalMode, setServiceForTests } from './service';

describe('service selection', () => {
  afterEach(() => setServiceForTests(null));

  it('is remote by default', async () => {
    expect(isLocalMode()).toBe(false);
    expect((await getService()).kind).toBe('remote');
  });

  it('?local=1 switches to local mode and sticks for the tab', async () => {
    window.history.replaceState({}, '', '/?local=1');
    expect(isLocalMode()).toBe(true);
    window.history.replaceState({}, '', '/r/ABCDEF');
    expect(isLocalMode()).toBe(true);
    expect(isFastLocal()).toBe(false);
    expect((await getService()).kind).toBe('local');
  });

  it('only local=1 enables local mode; local=0 clears it; other values are ignored', () => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/?local=0');
    expect(isLocalMode()).toBe(false);
    window.history.replaceState({}, '', '/?local=');
    expect(isLocalMode()).toBe(false);
    window.history.replaceState({}, '', '/?local=yes');
    expect(isLocalMode()).toBe(false);
    window.history.replaceState({}, '', '/?local=1');
    expect(isLocalMode()).toBe(true);
    window.history.replaceState({}, '', '/?local=junk');
    expect(isLocalMode()).toBe(true);
    window.history.replaceState({}, '', '/?local=0');
    expect(isLocalMode()).toBe(false);
    window.history.replaceState({}, '', '/');
    expect(isLocalMode()).toBe(false);
  });

  it('concurrent first calls share one service (one LocalHub)', async () => {
    window.history.replaceState({}, '', '/?local=1');
    const [a, b] = await Promise.all([getService(), getService()]);
    expect(a).toBe(b);
    const { code } = await a.createRoom({ maxPlayers: 3, playerId: 'p', name: 'A', avatar: '🦊' });
    expect(await b.roomExists(code)).toMatchObject({ exists: true });
    window.sessionStorage.clear();
  });

  it('?local=1&fast=1 enables fast local mode', () => {
    window.history.replaceState({}, '', '/?local=1&fast=1');
    expect(isLocalMode()).toBe(true);
    expect(isFastLocal()).toBe(true);
  });
});
