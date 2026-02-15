import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'classic' | 'dark';

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
        set((s) => ({ theme: s.theme === 'classic' ? 'dark' : 'classic' })),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      toggleAnimations: () =>
        set((s) => ({ animationsEnabled: !s.animationsEnabled })),
    }),
    { name: 'tysiac-preferences' },
  ),
);
