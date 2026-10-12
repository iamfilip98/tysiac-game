import type { Msg } from '../types';

/** Errors and rejections that do not come from the engine (worker, connection, local room). */
export const errors = {
  'errors.offline': "You're offline — reconnecting…",
  'errors.notPlaying': 'The game has not started yet',
} as const satisfies Record<string, Msg>;
