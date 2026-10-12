/**
 * Compile-time checks, no runtime code. `pnpm typecheck` fails here if:
 * - an English engine template does not use exactly the params the engine declares for its key, or
 * - a Polish or Danish message uses different placeholders than the English one.
 * The error message names the offending keys.
 */
import type { EngineMsgKey, EngineMsgParamName } from '@tysiac/engine';
import type { en } from './en';
import type { pl } from './pl';
import type { da } from './da';
import type { ExpectNone, MismatchedKeys, PlaceholdersOf } from './placeholders';

type En = typeof en;
type EngineMismatch = {
  [K in EngineMsgKey]: [PlaceholdersOf<En[`engine.${K}`]>] extends [EngineMsgParamName<K>]
    ? [EngineMsgParamName<K>] extends [PlaceholdersOf<En[`engine.${K}`]>]
      ? never
      : K
    : K;
}[EngineMsgKey];

export type CheckEngineParams = ExpectNone<EngineMismatch>;
export type CheckPolish = ExpectNone<MismatchedKeys<En, typeof pl>>;
export type CheckDanish = ExpectNone<MismatchedKeys<En, typeof da>>;
