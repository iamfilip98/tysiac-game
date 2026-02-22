import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';

export type Theme = 'classic' | 'dark' | 'chocolate' | 'midnight' | 'burgundy' | 'purple';
export type CardStyle = 'white' | 'black';

export const THEME_ORDER: Theme[] = ['classic', 'dark', 'chocolate', 'midnight', 'burgundy', 'purple'];
export const CARD_STYLE_ORDER: CardStyle[] = ['white', 'black'];

export interface PreferencesState {
  theme: Theme;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  cardStyle: CardStyle;
  emotesEnabled: boolean;
  guestName: string;
  avatarEmoji: string | null;
  tutorialCompleted: boolean;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleAnimations: () => void;
  toggleCardStyle: () => void;
  toggleEmotes: () => void;
  setGuestName: (name: string) => void;
  setAvatarEmoji: (emoji: string | null) => void;
  setTutorialCompleted: (done: boolean) => void;
}

const preferencesSlice = (set: (fn: (s: PreferencesState) => Partial<PreferencesState>) => void): PreferencesState => ({
  theme: 'classic',
  soundEnabled: true,
  animationsEnabled: true,
  cardStyle: 'white',
  emotesEnabled: true,
  guestName: '',
  avatarEmoji: null,
  tutorialCompleted: false,
  toggleTheme: () =>
    set((s) => {
      const idx = THEME_ORDER.indexOf(s.theme);
      const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
      return { theme: next };
    }),
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleAnimations: () =>
    set((s) => ({ animationsEnabled: !s.animationsEnabled })),
  toggleCardStyle: () =>
    set((s) => {
      const idx = CARD_STYLE_ORDER.indexOf(s.cardStyle);
      const next = CARD_STYLE_ORDER[(idx + 1) % CARD_STYLE_ORDER.length];
      return { cardStyle: next };
    }),
  toggleEmotes: () => set((s) => ({ emotesEnabled: !s.emotesEnabled })),
  setGuestName: (name: string) => set(() => ({ guestName: name })),
  setAvatarEmoji: (emoji: string | null) => set(() => ({ avatarEmoji: emoji })),
  setTutorialCompleted: (done: boolean) => set(() => ({ tutorialCompleted: done })),
});

/** Create a preferences store with a custom storage backend (e.g. AsyncStorage for mobile) */
export function createPreferencesStore(storage?: PersistStorage<PreferencesState>) {
  return create<PreferencesState>()(
    persist(
      (set) => preferencesSlice(set as (fn: (s: PreferencesState) => Partial<PreferencesState>) => void),
      {
        name: 'tysiac-preferences',
        ...(storage ? { storage } : {}),
      },
    ),
  );
}

/** Default singleton — uses localStorage on web */
export const usePreferencesStore = createPreferencesStore();
