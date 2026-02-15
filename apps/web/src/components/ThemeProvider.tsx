'use client';

import { useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Theme } from '@/stores/preferencesStore';

export const THEME_COLORS: Record<Theme, string> = {
  classic: '#1a3d2b',
  dark: '#1c1c22',
  chocolate: '#3d2517',
  midnight: '#0f1a3d',
  burgundy: '#3d1520',
  purple: '#261540',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((s) => s.theme);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Remove and recreate meta tag — iOS web clips don't detect attribute changes
    const existing = document.querySelector('meta[name="theme-color"]');
    if (existing) existing.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME_COLORS[theme] || THEME_COLORS.classic;
    document.head.appendChild(meta);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off',
    );
  }, [animationsEnabled]);

  return <>{children}</>;
}
