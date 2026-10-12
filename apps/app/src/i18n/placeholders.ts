import type { Msg } from './types';

/** The `{name}` placeholders of a template string, as a union. */
export type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholders<Rest> : never;
/** Placeholders of a message: a string, or the union over all plural forms. */
export type PlaceholdersOf<M> = M extends string
  ? Placeholders<M>
  : M extends { one: string; other: string }
    ? Placeholders<M['one'] | M['other'] | (M extends { few: string } ? M['few'] : never) | (M extends { many: string } ? M['many'] : never)>
    : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Keys of `E` whose message in `L` is missing or uses different placeholders (never = all good). */
export type MismatchedKeys<E extends Record<string, Msg>, L extends Record<string, Msg>> = {
  [K in keyof E]: K extends keyof L ? (Same<PlaceholdersOf<E[K]>, PlaceholdersOf<L[K]>> extends true ? never : K) : K;
}[keyof E];
/** Compiles only when T is never: `type _x = ExpectNone<MismatchedKeys<…>>`. The error names the bad keys. */
export type ExpectNone<T extends never> = T;
