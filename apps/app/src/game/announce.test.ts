import { describe, expect, it } from 'vitest';
import type { GameEvent } from '@tysiac/engine';
import { findState, viewOf } from '../test/fixtures';
import { announceText, announcementFor } from './announce';
import { loadLang } from '../i18n';

const view = viewOf(findState(s => s.phase === 'tricks'));
const ev = (e: Record<string, unknown>) => ({ audience: 'all', ...e }) as GameEvent;
const text = (e: Record<string, unknown>, me = 'me') => {
  const a = announcementFor(ev(e), me);
  return a && announceText(a, view);
};

describe('announcements', () => {
  it('announces in Polish without gendered verbs', async () => {
    await loadLang('pl');
    expect(text({ type: 'trickWon', p: 'z', cards: [], card: { suit: 'spades', rank: 'A' }, points: 25, byTrump: false })).toBe('Lewę bierze Bot Zenek (+25)');
    expect(text({ type: 'trickWon', p: 'me', cards: [], card: { suit: 'spades', rank: 'A' }, points: 25, byTrump: false })).toBe('Bierzesz lewę (+25)');
    expect(text({ type: 'cardPlayed', p: 'b', card: { suit: 'hearts', rank: 'Q' } })).toBe('Bot Basia zagrywa D♥\uFE0E');
    await loadLang('da');
    expect(text({ type: 'cardPlayed', p: 'b', card: { suit: 'hearts', rank: 'A' } })).toBe('Bot Basia spiller E♥\uFE0E');
    await loadLang('en');
  });

  it('says what others played and who took the trick', () => {
    expect(text({ type: 'cardPlayed', p: 'b', card: { suit: 'spades', rank: 'K' } })).toBe('Bot Basia played K♠\uFE0E');
    expect(text({ type: 'trickWon', p: 'z', cards: [], card: { suit: 'spades', rank: 'A' }, points: 25, byTrump: false })).toBe('Bot Zenek takes the trick (+25)');
    expect(text({ type: 'trickWon', p: 'me', cards: [], card: { suit: 'spades', rank: 'A' }, points: 25, byTrump: false })).toBe('You take the trick (+25)');
  });
  it('does not announce my own card', () => {
    expect(text({ type: 'cardPlayed', p: 'me', card: { suit: 'spades', rank: 'K' } })).toBeNull();
  });
  it('covers bidding, marriage, throw-in and hand-out', () => {
    expect(text({ type: 'bid', p: 'me', amount: 120 })).toBe('You bid 120');
    expect(text({ type: 'passed', p: 'b' })).toBe('Bot Basia passed');
    expect(text({ type: 'biddingWon', p: 'b', amount: 140, talonPublic: true })).toBe('Bot Basia won the bid at 140');
    expect(text({ type: 'marriage', p: 'z', suit: 'hearts', points: 100 })).toBe('Bot Zenek: marriage ♥\uFE0E +100 · trump is ♥\uFE0E');
    expect(text({ type: 'threw', p: 'b', amount: 140, summary: {} })).toBe('Bot Basia threw in at 140');
    expect(text({ type: 'handedOut', p: 'b', recipients: ['me', 'z'], cards: { me: { suit: 'hearts', rank: 'Q' } } })).toBe('You got Q♥\uFE0E from Bot Basia');
    expect(text({ type: 'handedOut', p: 'me', recipients: ['b', 'z'], cards: {} })).toBe('You handed out 2 cards');
  });
  it('announces talon confirmations', () => {
    expect(text({ type: 'talonSeen', p: 'b' })).toBe('Bot Basia has seen the talon');
    expect(text({ type: 'talonSeen', p: 'me' })).toBe('You have seen the talon');
  });
});
