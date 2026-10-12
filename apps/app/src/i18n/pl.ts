import type { Dict } from './en';
import { common } from './pl/common';
import { engine } from './pl/engine';
import { errors } from './pl/errors';
import { game } from './pl/game';
import { learn } from './pl/learn';
import { rules } from './pl/rules';
import { screens } from './pl/screens';

/** Polish. A lazy chunk: only loaded when the player picks Polski. */
export const pl = { ...common, ...engine, ...errors, ...game, ...learn, ...rules, ...screens } satisfies Dict;
