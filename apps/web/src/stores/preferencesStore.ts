import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'classic' | 'dark' | 'chocolate' | 'midnight' | 'burgundy' | 'purple';

export const THEME_ORDER: Theme[] = ['classic', 'dark', 'chocolate', 'midnight', 'burgundy', 'purple'];

interface PreferencesState {
  theme: Theme;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  toggleTheme: () => void;
  toggleSound: () => void;
  toggleAnimations: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'classic',
      soundEnabled: true,
      animationsEnabled: true,
      toggleTheme: () =>
        set((s) => {
          const idx = THEME_ORDER.indexOf(s.theme);
          const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
          return { theme: next };
        }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleAnimations: () =>
        set((s) => ({ animationsEnabled: !s.animationsEnabled })),
    }),
    { name: 'tysiac-preferences' },
  ),
);
