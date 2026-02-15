'use client';

import { useState, useRef, useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Theme } from '@/stores/preferencesStore';

const THEME_LABELS: Record<Theme, string> = {
  classic: 'Classic',
  dark: 'Dark',
  chocolate: 'Chocolate',
  midnight: 'Midnight',
  burgundy: 'Burgundy',
  purple: 'Purple',
};

export function SettingsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { theme, soundEnabled, animationsEnabled, toggleTheme, toggleSound, toggleAnimations } =
    usePreferencesStore();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="min-w-[36px] px-2 sm:px-3 py-1.5 bg-table-800/80 hover:bg-table-700 border border-white/[0.1] rounded-lg text-white/70 hover:text-white text-sm transition-colors"
        title="Settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="sm:hidden" aria-hidden="true">&#9881;</span>
        <span className="hidden sm:inline" aria-hidden="true">&#9881; Settings</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.1] rounded-lg shadow-xl z-50 py-1"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 40px rgba(0,0,0,0.4)' }}
        >
          {/* Sound */}
          <button
            onClick={toggleSound}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <span>Sound</span>
            <span className="text-xs text-white/50">{soundEnabled ? 'On' : 'Off'}</span>
          </button>

          {/* Theme */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <span>Theme</span>
            <span className="text-xs text-white/50">{THEME_LABELS[theme]}</span>
          </button>

          {/* Animations */}
          <button
            onClick={toggleAnimations}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <span>Animations</span>
            <span className="text-xs text-white/50">{animationsEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
