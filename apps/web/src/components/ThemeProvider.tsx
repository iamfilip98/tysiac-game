'use client';

import { useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Theme } from '@/stores/preferencesStore';

// Felt-primary colors per theme — used for meta theme-color (regular Safari toolbar)
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
    const color = THEME_COLORS[theme] || THEME_COLORS.classic;

    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color for regular Safari toolbar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', color);
    }

    // Force body background-color with felt-primary hex — iOS web clips sample this for the status bar.
    // Must be a literal value (not CSS variable) for iOS to pick up dynamic changes.
    document.body.style.backgroundColor = color;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off',
    );
  }, [animationsEnabled]);

  return <>{children}</>;
}
