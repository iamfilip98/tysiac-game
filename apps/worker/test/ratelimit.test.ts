import { describe, it, expect } from 'vitest';
import { RATE_MAX, RATE_WINDOW_MS, checkRate, newBucket } from '../src/ratelimit';

describe('checkRate', () => {
  it('allows 20 messages per second, warns once, then drops', () => {
    expect(RATE_MAX).toBe(20);
    const bucket = newBucket(1000);
    const verdicts = Array.from({ length: 23 }, () => checkRate(bucket, 1500));
    expect(verdicts.slice(0, 20).every((v) => v === 'ok')).toBe(true);
    expect(verdicts.slice(20)).toEqual(['warn', 'drop', 'drop']);
  });

  it('starts a fresh window after a second', () => {
    const bucket = newBucket(0);
    for (let i = 0; i < 25; i++) checkRate(bucket, 10);
    expect(checkRate(bucket, RATE_WINDOW_MS)).toBe('ok');
    expect(bucket).toEqual({ start: RATE_WINDOW_MS, count: 1, warned: false });
  });
});
