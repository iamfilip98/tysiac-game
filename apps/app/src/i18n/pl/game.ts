import type { AreaOf } from '../types';
import type { game as en } from '../en/game';

export const game = {
  'game.throwCost.free': 'Bomba: nikt nie dostaje punktów, nowe rozdanie.',
  'game.throwCost.paid': 'Bomba: ty −{amount}, pozostali po +{share} (0 na beczce).',
} as const satisfies AreaOf<typeof en>;
