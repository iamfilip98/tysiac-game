import { isOnBarrel } from '@tysiac/engine';
import { t } from '../i18n';

/** Score with its unit, in the active language ("230 pts", "230 punktów"). Uses a real minus sign. */
export function pts(n: number): string {
  return t('common.points', { n }).replace(/-(?=\d)/, '−');
}
export function bidChip(n: number): string {
  return t('game.chip.bid', { n });
}
export function passChip(): string {
  return t('game.chip.pass');
}
export const BARREL = '🛢';
export function onBarrel(total: number): boolean {
  return isOnBarrel(total);
}
