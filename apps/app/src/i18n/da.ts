import type { Dict } from './en';
import { common } from './da/common';
import { engine } from './da/engine';
import { errors } from './da/errors';
import { game } from './da/game';
import { learn } from './da/learn';
import { screens } from './da/screens';

/** Danish. A lazy chunk: only loaded when the player picks Dansk. */
export const da = { ...common, ...engine, ...errors, ...game, ...learn, ...screens } satisfies Dict;
