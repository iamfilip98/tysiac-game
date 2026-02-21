import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'classic' | 'dark' | 'chocolate' | 'midnight' | 'burgundy' | 'purple';
export type CardStyle = 'white' | 'black';

export const THEME_ORDER: Theme[] = ['classic', 'dark', 'chocolate', 'midnight', 'burgundy', 'purple'];
export const CARD_STYLE_ORDER: CardStyle[] = ['white', 'black'];

interface PreferencesState {
  theme: Theme;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  cardStyle: CardStyle;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleAnimations: () => void;
  toggleCardStyle: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'classic',
      soundEnabled: true,
      animationsEnabled: true,
      cardStyle: 'white',
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
    }),
    { name: 'tysiac-preferences' },
  ),
);
