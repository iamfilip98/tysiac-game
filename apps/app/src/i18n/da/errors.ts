import type { AreaOf } from '../types';
import type { errors as en } from '../en/errors';

export const errors = {
  'errors.offline': 'Du er offline — forbinder igen…',
  'errors.notPlaying': 'Spillet er ikke begyndt endnu',
} as const satisfies AreaOf<typeof en>;
