export type Lang = 'en' | 'pl' | 'da';
export const LANGS: readonly Lang[] = ['en', 'pl', 'da'];
/** Plural forms. Polish uses one/few/many, Danish and English one/other. `other` is the fallback. */
export type Plural = { readonly one: string; readonly few?: string; readonly many?: string; readonly other: string };
export type Msg = string | Plural;
export type Params = Record<string, string | number>;
/** Same keys as the English area, any Msg values: the type checker rejects missing and extra keys. */
export type AreaOf<T> = { readonly [K in keyof T]: Msg };
