/**
 * NOTE: this deliberately imports the app's English dictionary, so rewording an app string can break
 * engine tests that assert on rendered sentences. Update the expectations along with the wording.
 *
 * Test-only English renderer for engine messages. The engine returns { key, params }; its English wording
 * lives in the app's dictionary (apps/app/src/i18n/en/engine.ts), which this reads so engine tests can
 * keep asserting readable sentences. Mirrors the app's engineText() for English.
 */
import { engine as EN } from '../../../apps/app/src/i18n/en/engine';
import { SUIT_SYMBOL } from '../src/rules';
import type { EngineMsg, MsgParam } from '../src/messages';
import type { PlayerView } from '../src/types';

const LIST = new Intl.ListFormat('en', { type: 'conjunction' });

function param(v: MsgParam, view: PlayerView | null): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if ('card' in v) return `${v.card.rank}${SUIT_SYMBOL[v.card.suit]}`;
  if ('suit' in v) return SUIT_SYMBOL[v.suit];
  if ('player' in v) return view && v.player === view.me ? 'You' : (view?.seats.find(s => s.id === v.player)?.name ?? 'Someone');
  if ('signed' in v) return v.signed > 0 ? `+${v.signed}` : v.signed < 0 ? `−${-v.signed}` : '0';
  if ('and' in v) return LIST.format(v.and.map(x => param(x, view)));
  if ('list' in v) return v.list.map(x => param(x, view)).join(', ');
  return v.msgs.map(m => english(m, view)).join(' ');
}

export function english(m: EngineMsg, view: PlayerView | null = null): string {
  const tpl = EN[`engine.${m.key}`];
  const params = Object.fromEntries(Object.entries(m.params ?? {}).map(([k, v]) => [k, param(v, view)]));
  const n = Number(params.n ?? 0);
  const text = typeof tpl === 'string' ? tpl : n === 1 ? tpl.one : tpl.other;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    if (!(k in params)) throw new Error(`${m.key}: missing {${k}}`);
    return params[k];
  });
}
