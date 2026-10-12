import type { AreaOf } from '../types';
import type { errors as en } from '../en/errors';

export const errors = {
  'errors.offline': 'Brak połączenia — łączę ponownie…',
  'errors.notPlaying': 'Gra jeszcze się nie zaczęła',
} as const satisfies AreaOf<typeof en>;
