'use client';

import { useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Theme } from '@/stores/preferencesStore';

// Darkest color per theme — used for meta theme-color and iOS status bar
export const THEME_COLORS: Record<Theme, string> = {
  classic: '#052e16',
  dark: '#08080c',
  chocolate: '#1a0f07',
  midnight: '#070b18',
  burgundy: '#1a070c',
  purple: '#0f0719',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((s) => s.theme);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const cardStyle = usePreferencesStore((s) => s.cardStyle);

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

  useEffect(() => {
    if (cardStyle === 'auto') {
      document.documentElement.removeAttribute('data-card-style');
    } else {
      document.documentElement.setAttribute('data-card-style', cardStyle);
    }
  }, [cardStyle]);

  return <>{children}</>;
}
