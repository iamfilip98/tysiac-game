import { describe, it, expect } from 'vitest';
import {
  AWAY_TAKEOVER_MS, CLEANUP_AFTER_MS, botDelayMs, canTakeOver, nextAlarmAt, parseScale,
} from '../src/scheduler';

const fixed = (x: number) => () => x;

describe('botDelayMs', () => {
  it('waits 600–900 ms by default', () => {
    expect(botDelayMs([], fixed(0))).toBe(600);
    expect(botDelayMs([], fixed(0.5))).toBe(750);
    expect(botDelayMs([], fixed(0.999999))).toBe(900);
  });

  it('adds 1100 ms after a trick and 1500 ms after a scored round (cumulative)', () => {
    expect(botDelayMs([{ type: 'cardPlayed' }, { type: 'trickWon' }], fixed(0))).toBe(1700);
    expect(botDelayMs([{ type: 'roundScored' }], fixed(0))).toBe(2100);
    expect(botDelayMs([{ type: 'cardPlayed' }, { type: 'trickWon' }, { type: 'roundScored' }, { type: 'dealt' }], fixed(0))).toBe(3200);
  });

  it('scales (tests run with scale 0.1)', () => {
    expect(botDelayMs([{ type: 'trickWon' }], fixed(0), 0)).toBe(0);
    expect(botDelayMs([], fixed(0), 2)).toBe(1200);
  });
});

describe('schedule helpers', () => {
  it('the single alarm fires at the earliest entry', () => {
    expect(nextAlarmAt({ bot: null, cleanup: 5000 })).toBe(5000);
    expect(nextAlarmAt({ bot: 1200, cleanup: 5000 })).toBe(1200);
    expect(nextAlarmAt({ bot: 9000, cleanup: 5000 })).toBe(5000);
  });

  it('a bot may take over 30 s after a disconnect', () => {
    expect(AWAY_TAKEOVER_MS).toBe(30_000);
    expect(canTakeOver(null, 100_000)).toBe(false);
    expect(canTakeOver(100_000, 129_999)).toBe(false);
    expect(canTakeOver(100_000, 130_000)).toBe(true);
  });

  it('cleanup is 7 days', () => {
    expect(CLEANUP_AFTER_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('parses BOT_DELAY_SCALE defensively', () => {
    expect(parseScale(undefined)).toBe(1);
    expect(parseScale('0')).toBe(0);
    expect(parseScale('0.5')).toBe(0.5);
    expect(parseScale('abc')).toBe(1);
    expect(parseScale('-1')).toBe(1);
    expect(parseScale('')).toBe(1);
  });
});
