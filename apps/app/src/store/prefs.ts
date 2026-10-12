import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { applyTheme, isThemeId, type ThemeId } from '../theme/theme';
import { safeLocalStorage } from './storage';

export type Speed = 'normal' | 'fast';
export interface LastRoom {
  code: string;
  practice: boolean;
  at: number;
  /** Set by "Practice with coach" (Learn): the coach is on in this room whatever the setting says. */
  coach?: boolean;
}
export interface Prefs {
  name: string;
  avatar: string;
  theme: ThemeId;
  sound: boolean;
  /** null = automatic (on in practice and for the first 3 games). */
  coach: boolean | null;
  speed: Speed;
  gamesStarted: number;
  countedRoom: string | null;
  lastRoom: LastRoom | null;
}
interface PrefsActions {
  setProfile(name: string, avatar: string): void;
  setTheme(id: ThemeId): void;
  setSound(on: boolean): void;
  setCoach(on: boolean): void;
  setSpeed(speed: Speed): void;
  setLastRoom(room: LastRoom | null): void;
  noteGameStarted(code: string): void;
}

export const AVATARS = ['🦊', '🐻', '🦉', '🐺', '🐸', '🐼', '🦁', '🐯', '🐨', '🐙', '🦄', '🐝'] as const;
export const NAME_MAX = 16;

/** Server NameSchema limit, in UTF-16 code units. */
export const NAME_MAX_UNITS = 24;

/** Trims, collapses whitespace and caps at NAME_MAX code points and NAME_MAX_UNITS UTF-16 units (emoji-safe). */
export function cleanName(raw: string): string {
  let out = '';
  let count = 0;
  for (const ch of raw.replace(/\s+/g, ' ').trim()) {
    if (count >= NAME_MAX || out.length + ch.length > NAME_MAX_UNITS) break;
    out += ch;
    count++;
  }
  return out.trim();
}

export function coachEnabled(p: Pick<Prefs, 'coach' | 'gamesStarted'>, practice: boolean): boolean {
  return p.coach ?? (practice || p.gamesStarted < 3);
}

/**
 * The coach flag to send in `hello` for a room. The automatic default (practice / first 3 games) is decided
 * once per room per browser session and remembered, so a reconnect never flips it mid-game; an explicit
 * choice in Settings (`prefs.coach !== null`) always wins.
 */
export function coachForRoom(code: string, p: Pick<Prefs, 'coach' | 'gamesStarted'>, practice: boolean): boolean {
  if (p.coach !== null) return p.coach;
  const key = `tysiac.coach.${code}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved === '1' || saved === '0') return saved === '1';
  } catch {
    /* storage unavailable: fall through */
  }
  const value = coachEnabled(p, practice);
  try {
    sessionStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore */
  }
  return value;
}

export const usePrefs = create<Prefs & PrefsActions>()(
  persist(
    set => ({
      name: '',
      avatar: AVATARS[0],
      theme: 'brass',
      sound: true,
      coach: null,
      speed: 'normal',
      gamesStarted: 0,
      countedRoom: null,
      lastRoom: null,
      setProfile: (name, avatar) => set({ name: cleanName(name), avatar }),
      setTheme: id => {
        applyTheme(id);
        set({ theme: id });
      },
      setSound: on => set({ sound: on }),
      setCoach: on =>
        // An explicit choice overrides a "Practice with coach" forced flag for the current room.
        set(s => ({ coach: on, lastRoom: s.lastRoom?.coach ? { ...s.lastRoom, coach: undefined } : s.lastRoom })),
      setSpeed: speed => set({ speed }),
      setLastRoom: room => set({ lastRoom: room }),
      noteGameStarted: code =>
        set(s => (s.countedRoom === code ? s : { gamesStarted: s.gamesStarted + 1, countedRoom: code })),
    }),
    {
      name: 'tysiac.prefs',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage()),
      partialize: s => ({
        name: s.name, avatar: s.avatar, theme: s.theme, sound: s.sound, coach: s.coach, speed: s.speed,
        gamesStarted: s.gamesStarted, countedRoom: s.countedRoom, lastRoom: s.lastRoom,
      }),
      onRehydrateStorage: () => state => {
        if (state && isThemeId(state.theme)) applyTheme(state.theme);
      },
    },
  ),
);
