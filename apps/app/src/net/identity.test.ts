import { describe, expect, it, vi } from 'vitest';
import { getIdentity } from './identity';
import { safeLocalStorage } from '../store/storage';

describe('identity', () => {
  it('is created once and then reused', () => {
    const a = getIdentity();
    const b = getIdentity();
    expect(a).toEqual(b);
    expect(a.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.secret).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.playerId).not.toBe(a.secret);
    expect(JSON.parse(localStorage.getItem('tysiac.identity')!)).toEqual(a);
  });

  it('replaces garbage in storage', () => {
    localStorage.setItem('tysiac.identity', '{"playerId":42}');
    const a = getIdentity();
    expect(typeof a.playerId).toBe('string');
    expect(a.playerId).toHaveLength(36);
  });

  it('works when localStorage throws (private mode)', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      const store = safeLocalStorage();
      store.setItem('k', 'v');
      expect(store.getItem('k')).toBe('v');
      expect(getIdentity(store)).toEqual(getIdentity(store));
    } finally {
      spy.mockRestore();
    }
  });
});
