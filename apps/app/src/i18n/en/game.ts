import type { Msg } from '../types';

/** The game screen: action zone, table, bars, sheets and the announcement ticker. */
export const game = {
  'game.throwCost.free': 'Throw in: nobody scores, new deal.',
  'game.throwCost.paid': 'Throw in: you −{amount}, others +{share} each (0 on the barrel).',
} as const satisfies Record<string, Msg>;
