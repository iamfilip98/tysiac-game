import type { GameEvent } from '@tysiac/engine';

export const BOT_DELAY_MIN_MS = 600;
export const BOT_DELAY_SPREAD_MS = 300;
export const AFTER_TRICK_MS = 1100;
export const AFTER_ROUND_MS = 1500;
export const AWAY_TAKEOVER_MS = 30_000;
export const CLEANUP_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Everything the Room's single alarm must do, as ms-epoch due times. */
export interface Schedule {
  bot: number | null;
  cleanup: number;
}

/**
 * Delay before a bot acts (spec §6): 600–900 ms, +1100 ms if the events that led here include a won
 * trick (let the sweep play), +1500 ms if they include a finished round (scored or thrown in) (let the result sheet show).
 */
export function botDelayMs(events: readonly Pick<GameEvent, 'type'>[], rand: () => number, scale = 1): number {
  let ms = BOT_DELAY_MIN_MS + Math.floor(rand() * (BOT_DELAY_SPREAD_MS + 1));
  if (events.some((e) => e.type === 'trickWon')) ms += AFTER_TRICK_MS;
  // A round ends with exactly one of `threw` (thrown in) or `roundScored`.
  if (events.some((e) => e.type === 'roundScored' || e.type === 'threw')) ms += AFTER_ROUND_MS;
  return Math.round(ms * scale);
}

export function nextAlarmAt(s: Schedule): number {
  return s.bot === null ? s.cleanup : Math.min(s.bot, s.cleanup);
}

export function canTakeOver(awaySince: number | null, now: number): boolean {
  return awaySince !== null && now - awaySince >= AWAY_TAKEOVER_MS;
}

/** BOT_DELAY_SCALE var: "1" in production, "0.1" in tests. Anything invalid means 1. */
export function parseScale(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}
