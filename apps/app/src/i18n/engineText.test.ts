import { afterEach, describe, expect, it } from 'vitest';
import { ENGINE_MSG_KEYS, msg } from '@tysiac/engine';
import { findState, viewOf } from '../test/fixtures';
import { en } from './en';
import { appLine, engineText, lineText, rejectText } from './engineText';
import { loadLang } from './index';

const view = viewOf(findState(s => s.phase === 'tricks'));
afterEach(() => loadLang('en'));

describe('engineText', () => {
  it('has an English text for every engine key', () => {
    for (const k of ENGINE_MSG_KEYS) expect(en[`engine.${k}` as keyof typeof en], k).toBeTruthy();
  });
  it('renders players, cards and suits in the active language', async () => {
    const m = { key: 'illegal.mustBeat', params: { card: { card: { suit: 'hearts', rank: 'Q' } } } } as const;
    expect(engineText(m, view)).toBe('First to respond must beat Q♥ if you can');
    await loadLang('pl');
    expect(engineText(m, view)).toBe('Pierwszy odpowiadający musi przebić D♥, jeśli może');
    expect(engineText({ key: 'illegal.waitFor', params: { player: { player: 'b' } } }, view)).toBe('Poczekaj na ruch: Bot Basia');
    await loadLang('da');
    expect(engineText(m, view)).toBe('Den første, der svarer, skal stikke D♥ over, hvis det er muligt');
  });
  it('lists, signed numbers, nested sentences and plurals', async () => {
    const throwIn = msg('event.threw.changes', {
      player: { player: 'b' },
      amount: 130,
      changes: { list: [{ msgs: [msg('event.change', { player: { player: 'b' }, delta: { signed: -130 } })] }, { msgs: [msg('event.change.you', { delta: { signed: 60 } })] }] },
    });
    expect(engineText(throwIn, view)).toBe('Bot Basia threw in at 130: Bot Basia −130, You +60.');
    const voids = msg('coach.why.voidTrump', { suits: { and: [{ suit: 'hearts' }, { suit: 'spades' }] } });
    expect(engineText(voids, view)).toBe("You're void in ♥ and ♠. You can discard or trump when it is led");
    await loadLang('pl');
    expect(engineText(throwIn, view)).toBe('Bot Basia rzuca bombę przy 130: Bot Basia −130, Ty +60.');
    expect(engineText(voids, view)).toMatch(/♥ i ♠/);
    expect(engineText(msg('coach.why.aces', { n: 2 }), view)).toMatch(/^2 asy/);
    expect(engineText(msg('coach.why.aces', { n: 5 }), view)).toMatch(/^5 asów/);
  });
  it('app lines and reject toasts', async () => {
    expect(lineText(appLine('learn.advice.bid', { amount: 120 }), view)).toBe('Bid 120');
    expect(rejectText({ code: 'notYourTurn', message: 'reject.notYourTurn', msg: msg('reject.notYourTurn') }, view)).toBe("It's not your turn");
    expect(rejectText({ code: 'offline', message: 'offline' }, view)).toBe("You're offline. Reconnecting…");
    expect(rejectText({ code: 'lesson', message: 'Lesson: Pass.' }, view)).toBe('Lesson: Pass.');
    await loadLang('da');
    expect(rejectText({ code: 'notYourTurn', message: 'reject.notYourTurn', msg: msg('reject.notYourTurn') }, view)).toBe('Det er ikke din tur');
  });
});
