import { beforeEach, describe, expect, it } from 'vitest';
import { ClientMessageSchema } from '@tysiac/protocol';
import { AVATARS, cleanName, coachEnabled, usePrefs } from './prefs';

const reset = () =>
  usePrefs.setState({ name: '', avatar: AVATARS[0], theme: 'brass', sound: true, coach: null, speed: 'normal', gamesStarted: 0, countedRoom: null, lastRoom: null });

describe('prefs', () => {
  beforeEach(reset);

  it('cleanName trims, collapses and caps by code point', () => {
    expect(cleanName('   ')).toBe('');
    expect(cleanName('  Ania   Kowalska  ')).toBe('Ania Kowalska');
    expect(cleanName('x'.repeat(40))).toBe('x'.repeat(16));
    expect([...cleanName('🦊'.repeat(20))]).toHaveLength(12); // 24 UTF-16 units
    expect(cleanName('Zenek\n\tB.')).toBe('Zenek B.');
  });

  it('cleanName output is accepted by the server name schema', () => {
    for (const raw of ['🦊'.repeat(16), '🦊'.repeat(40), 'x'.repeat(40), 'Ania 🦊 Kowalska']) {
      const name = cleanName(raw);
      expect(name.length).toBeLessThanOrEqual(24);
      const r = ClientMessageSchema.safeParse({ t: 'hello', v: 2, playerId: 'p1', secret: 'secret123', name, avatar: '🦊', coach: false });
      expect(r.success || JSON.stringify(r.error.issues)).toBe(true);
    }
  });

  it('coach is on for practice and the first 3 games unless set explicitly', () => {
    expect(coachEnabled({ coach: null, gamesStarted: 0 }, false)).toBe(true);
    expect(coachEnabled({ coach: null, gamesStarted: 3 }, false)).toBe(false);
    expect(coachEnabled({ coach: null, gamesStarted: 9 }, true)).toBe(true);
    expect(coachEnabled({ coach: false, gamesStarted: 0 }, true)).toBe(false);
    expect(coachEnabled({ coach: true, gamesStarted: 9 }, false)).toBe(true);
  });

  it('persists under tysiac.prefs and applies the theme', () => {
    usePrefs.getState().setProfile('Filip', '🐻');
    usePrefs.getState().setTheme('wycinanki');
    const saved = JSON.parse(localStorage.getItem('tysiac.prefs')!);
    expect(saved.state).toMatchObject({ name: 'Filip', avatar: '🐻', theme: 'wycinanki' });
    expect(document.documentElement.dataset.theme).toBe('wycinanki');
  });

  it('counts a started game once per room code', () => {
    const p = usePrefs.getState();
    p.noteGameStarted('ABCDEF');
    p.noteGameStarted('ABCDEF');
    p.noteGameStarted('GHJKMN');
    expect(usePrefs.getState().gamesStarted).toBe(2);
  });

  it('setProfile cleans the name', () => {
    usePrefs.getState().setProfile('  Ola  ', '🦉');
    expect(usePrefs.getState().name).toBe('Ola');
  });
});
