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

// Table-950 colors per theme (darkest bg) for body background-color
const TABLE_950_COLORS: Record<Theme, string> = {
  classic: '#052e16',
  dark: '#0a0a0a',
  chocolate: '#1a0f07',
  midnight: '#070b18',
  burgundy: '#1a070c',
  purple: '#0f0719',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = usePreferencesStore((s) => s.theme);
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color (still helps on Android and older iOS)
    const existing = document.querySelector('meta[name="theme-color"]');
    if (existing) existing.remove();
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = THEME_COLORS[theme] || THEME_COLORS.classic;
    document.head.appendChild(meta);

    // Force body background-color update for iOS Safari status bar sampling
    document.body.style.backgroundColor = TABLE_950_COLORS[theme] || TABLE_950_COLORS.classic;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-animations',
      animationsEnabled ? 'on' : 'off',
    );
  }, [animationsEnabled]);

  const feltColor = THEME_COLORS[theme] || THEME_COLORS.classic;

  return (
    <>
      {/* Real DOM element for iOS status bar area — pseudo-elements aren't sampled by Safari */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'env(safe-area-inset-top, 0px)',
          backgroundColor: feltColor,
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      />
      {children}
    </>
  );
}
