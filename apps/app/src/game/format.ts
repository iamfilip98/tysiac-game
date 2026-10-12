import { isOnBarrel } from '@tysiac/engine';

/** Score with its unit. Uses a real minus sign. Stream P localises these strings. */
export function pts(n: number): string {
  return `${n < 0 ? `\u2212${-n}` : n} pts`;
}
export function bidChip(n: number): string {
  return `bid ${n}`;
}
export const PASS_CHIP = 'pass';
export const BARREL = '🛢';
export function onBarrel(total: number): boolean {
  return isOnBarrel(total);
}
