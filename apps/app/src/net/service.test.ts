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

  it('?local=1&fast=1 enables fast local mode', () => {
    window.history.replaceState({}, '', '/?local=1&fast=1');
    expect(isLocalMode()).toBe(true);
    expect(isFastLocal()).toBe(true);
  });
});
