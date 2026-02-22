'use client';

import { useEffect } from 'react';
import { usePreferencesStore, type Theme } from '@tysiac/game-logic';

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

    // Force background-color with literal hex — iOS web clips sample this for the status bar.
    // Set on both html and body to prevent any gaps on iOS safe areas.
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off',
    );
  }, [animationsEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute('data-card-style', cardStyle);
  }, [cardStyle]);

  return <>{children}</>;
}
