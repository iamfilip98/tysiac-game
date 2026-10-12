import { SUIT_SYMBOL, type Action, type Card, type EngineMsg, type MsgParam, type PlayerId, type PlayerView } from '@tysiac/engine';
import { en, type MsgKey } from './en';
import type { PlaceholdersOf } from './placeholders';
import { currentLang, t, tAny } from './index';

/** A card in the active language: localised rank letter + suit glyph (Polish D♥, Danish D♥, English Q♥). */
export function cardText(card: Card): string {
  return `${t(`card.rank.${card.rank}`)}${SUIT_SYMBOL[card.suit]}`;
}

/** The seat's name, "You" (in the active language) for the viewer. */
export function playerName(view: PlayerView | null, p: PlayerId): string {
  if (view && p === view.me) return t('common.you');
  return view?.seats.find(s => s.id === p)?.name ?? t('common.someone');
}

function param(v: MsgParam, view: PlayerView | null): string | number {
  if (v === null || typeof v !== 'object') return typeof v === 'string' || typeof v === 'number' ? v : '';
  if (typeof v === 'string' || typeof v === 'number') return v;
  if ('card' in v) return cardText(v.card);
  if ('suit' in v) return SUIT_SYMBOL[v.suit];
  if ('player' in v) return playerName(view, v.player);
  if ('signed' in v) return v.signed > 0 ? `+${v.signed}` : v.signed < 0 ? `−${-v.signed}` : '0';
  if ('and' in v) return new Intl.ListFormat(currentLang(), { type: 'conjunction' }).format(v.and.map(x => String(param(x, view))));
  if ('list' in v) return v.list.map(x => param(x, view)).join(', ');
  if ('msgs' in v) return v.msgs.map(m => engineText(m, view)).join(' ');
  return '';
}

/** Renders an engine message in the active language. Suit glyphs are plain: wrap in textSuits() for display. */
export function engineText(m: EngineMsg, view: PlayerView | null): string {
  return tAny(`engine.${m.key}` as MsgKey, renderParams(m.params, view));
}

function renderParams(params: Record<string, MsgParam> | undefined, view: PlayerView | null): Record<string, string | number> {
  return Object.fromEntries(Object.entries(params ?? {}).map(([k, v]) => [k, param(v, view)]));
}

/** An app-side message (lesson advice and the like): a dictionary key with engine-style params. */
export interface AppLine {
  app: MsgKey;
  params?: Record<string, MsgParam>;
}
/** One coach line: from the engine (advise, explainEvent) or from the app (the lesson script). */
export type Line = EngineMsg | AppLine;
/** Advice as the Game screen shows it: the engine's Advice, or the lesson's scripted one. */
export interface CoachAdvice {
  action: Action;
  headline: Line;
  reasons: Line[];
}

/** Builds an app line; every placeholder of the English text is a required param. */
export function appLine<K extends MsgKey>(
  key: K,
  ...args: [PlaceholdersOf<(typeof en)[K]>] extends [never] ? [] : [params: { [P in PlaceholdersOf<(typeof en)[K]>]: MsgParam }]
): AppLine {
  const params = args[0] as Record<string, MsgParam> | undefined;
  return params ? { app: key, params } : { app: key };
}

/** Renders a line in the active language (plain suit glyphs: wrap in textSuits() for display). */
export function lineText(l: Line, view: PlayerView | null): string {
  if ('key' in l) return engineText(l, view);
  return tAny(l.app, renderParams(l.params, view));
}

/** Known reject/error codes that are not engine messages: shown in the active language. */
const REJECT_CODES: Partial<Record<string, MsgKey>> = {
  offline: 'errors.offline',
  notPlaying: 'errors.notPlaying',
};

/** The toast for a `reject`: the engine's message translated, a known worker code translated, else its text. */
export function rejectText(m: { code: string; message: string; msg?: EngineMsg }, view: PlayerView | null): string {
  if (m.msg && `engine.${m.msg.key}` in en) return engineText(m.msg, view);
  const key = REJECT_CODES[m.code];
  return key ? tAny(key) : m.message;
}
