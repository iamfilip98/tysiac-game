import { en, type Dict, type MsgKey } from './en';
import type { Lang, Msg, Params } from './types';

export type { Lang, Msg, Params } from './types';
export type { MsgKey } from './en';

let dict: Dict = en;
let lang: Lang = 'en';
const loaders: Record<Exclude<Lang, 'en'>, () => Promise<Dict>> = {
  pl: () => import('./pl').then(m => m.pl),
  da: () => import('./da').then(m => m.da),
};

export function currentLang(): Lang {
  return lang;
}

/** Swaps the active dictionary. A failed chunk load (offline, not cached) keeps the current one and rethrows. */
export async function loadLang(next: Lang): Promise<void> {
  dict = next === 'en' ? en : await loaders[next]();
  lang = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function pluralCategory(l: Lang, n: number): 'one' | 'few' | 'many' | 'other' {
  const a = Math.abs(n);
  if (l !== 'pl') return a === 1 ? 'one' : 'other';
  if (a === 1) return 'one';
  const d = a % 10;
  const h = a % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? 'few' : 'many';
}

function pick(m: Msg, params?: Params): string {
  if (typeof m === 'string') return m;
  const n = Number(params?.n ?? 0);
  const cat = pluralCategory(lang, n);
  return (cat === 'few' ? m.few : cat === 'many' ? m.many : cat === 'one' ? m.one : undefined) ?? m.other;
}

/** The text for `key` in the active language, with `{name}` placeholders filled from `params` (`n` picks the plural form). */
export function t(key: MsgKey, params?: Params): string {
  const text = pick(dict[key] ?? en[key], params);
  return params ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all)) : text;
}
