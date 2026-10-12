import type { Msg } from './types';
import { common } from './en/common';

export const en = { ...common };
export type MsgKey = keyof typeof en;
export type Dict = { readonly [K in MsgKey]: Msg };
