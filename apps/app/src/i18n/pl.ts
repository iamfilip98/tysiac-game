import type { Dict } from './en';
import { common } from './pl/common';
import { engine } from './pl/engine';
import { errors } from './pl/errors';
import { game } from './pl/game';
import { learn } from './pl/learn';

/** Polish. A lazy chunk: only loaded when the player picks Polski. */
export const pl = { ...common, ...engine, ...errors, ...game, ...learn } satisfies Dict;
