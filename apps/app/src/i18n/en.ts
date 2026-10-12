import type { Msg } from './types';
import { common } from './en/common';
import { engine } from './en/engine';
import { errors } from './en/errors';
import { game } from './en/game';
import { learn } from './en/learn';
import { rules } from './en/rules';
import { screens } from './en/screens';

/** The English dictionary: the source of every key. Always loaded (part of the initial bundle). */
export const en = { ...common, ...engine, ...errors, ...game, ...learn, ...rules, ...screens };
export type MsgKey = keyof typeof en;
export type Dict = { readonly [K in MsgKey]: Msg };
