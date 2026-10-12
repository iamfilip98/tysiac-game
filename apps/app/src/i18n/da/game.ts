import type { AreaOf } from '../types';
import type { game as en } from '../en/game';

export const game = {
  'game.throwCost.free': 'Giv op: ingen får point, kortene gives igen.',
  'game.throwCost.paid': 'Giv op: du −{amount}, de andre +{share} hver (0 på tønden).',
} as const satisfies AreaOf<typeof en>;
