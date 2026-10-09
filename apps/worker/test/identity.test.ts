import { describe, it, expect } from 'vitest';
import { randomHex, safeEqual, sha256Hex } from '../src/identity';

describe('identity helpers', () => {
  it('sha256Hex matches the standard test vector', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('safeEqual compares exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });

  it('randomHex returns lowercase hex of the requested size', () => {
    const a = randomHex(8);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(randomHex(8)).not.toBe(a);
  });
});
