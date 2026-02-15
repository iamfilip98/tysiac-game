'use client';

import { useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((s) => s.theme);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off',
    );
  }, [animationsEnabled]);

  return <>{children}</>;
}
