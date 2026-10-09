export const RATE_WINDOW_MS = 1000;
export const RATE_MAX = 20;

export interface RateBucket {
  start: number;
  count: number;
  warned: boolean;
}

export type RateVerdict = 'ok' | 'warn' | 'drop';

export function newBucket(now: number): RateBucket {
  return { start: now, count: 0, warned: false };
}

/** Fixed 1 s window per socket. Over the limit: one 'warn' (send rateLimited), then 'drop' silently. */
export function checkRate(bucket: RateBucket, now: number): RateVerdict {
  if (now - bucket.start >= RATE_WINDOW_MS) {
    bucket.start = now;
    bucket.count = 0;
    bucket.warned = false;
  }
  bucket.count += 1;
  if (bucket.count <= RATE_MAX) return 'ok';
  if (!bucket.warned) {
    bucket.warned = true;
    return 'warn';
  }
  return 'drop';
}
