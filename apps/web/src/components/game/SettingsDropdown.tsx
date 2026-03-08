'use client';

import { useState, useRef, useEffect } from 'react';
import { usePreferencesStore, type Theme, type CardStyle } from '@tysiac/game-logic';

const THEME_LABELS: Record<Theme, string> = {
  classic: 'Classic',
  dark: 'Dark',
  chocolate: 'Chocolate',
  midnight: 'Midnight',
  burgundy: 'Burgundy',
  purple: 'Purple',
};

const CARD_STYLE_LABELS: Record<CardStyle, string> = {
  white: 'White',
  black: 'Dark',
};

interface SettingsDropdownProps {
  isPrivate?: boolean;
  roomCode?: string | null;
  isPaused?: boolean;
  phase?: string;
  onPause?: () => void;
  onCopyCode?: () => void;
  onShowRules?: () => void;
}

export function SettingsDropdown({ isPrivate, roomCode, isPaused, phase, onPause, onCopyCode, onShowRules }: SettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { theme, soundEnabled, animationsEnabled, cardStyle, emotesEnabled, toggleTheme, toggleSound, toggleAnimations, toggleCardStyle, toggleEmotes } =
    usePreferencesStore();

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-toolbar min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5"
        title="Settings"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? 'settings-menu' : undefined}
      >
        <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span className="hidden sm:inline">Settings</span>
      </button>

      {open && (
        <div
          id="settings-menu"
          role="menu"
          aria-label="Settings"
          className="absolute right-0 top-full mt-1 w-52 bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.12] rounded-lg shadow-xl z-50 py-1"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.5)' }}
        >
          {/* Sound */}
          <button
            role="menuitem"
            onClick={toggleSound}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {soundEnabled ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              )}
            </svg>
            <span className="flex-1 text-left">Sound</span>
            <span className={`text-xs ${soundEnabled ? 'text-gold-400' : 'text-white/40'}`}>{soundEnabled ? 'On' : 'Off'}</span>
          </button>

          {/* Theme */}
          <button
            role="menuitem"
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <span className="flex-1 text-left">Theme</span>
            <span className="text-xs text-gold-400">{THEME_LABELS[theme]}</span>
          </button>

          {/* Animations */}
          <button
            role="menuitem"
            onClick={toggleAnimations}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="flex-1 text-left">Animations</span>
            <span className={`text-xs ${animationsEnabled ? 'text-gold-400' : 'text-white/40'}`}>{animationsEnabled ? 'On' : 'Off'}</span>
          </button>

          {/* Card Style */}
          <button
            role="menuitem"
            onClick={toggleCardStyle}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8 L13.5 11.5 L12 15 L10.5 11.5 Z" fill="currentColor" opacity="0.5" />
            </svg>
            <span className="flex-1 text-left">Cards</span>
            <span className="text-xs text-gold-400">{CARD_STYLE_LABELS[cardStyle]}</span>
          </button>

          {/* Emotes */}
          <button
            role="menuitem"
            onClick={toggleEmotes}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span className="flex-1 text-left">Emotes</span>
            <span className={`text-xs ${emotesEnabled ? 'text-gold-400' : 'text-white/40'}`}>{emotesEnabled ? 'On' : 'Off'}</span>
          </button>

          {/* Pause — private rooms only */}
          {isPrivate && phase !== 'gameEnd' && !isPaused && onPause && (
            <button
              role="menuitem"
              onClick={() => { onPause(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
            >
              <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span className="flex-1 text-left">Pause Game</span>
            </button>
          )}

          {/* Room code — private rooms only */}
          {isPrivate && roomCode && onCopyCode && (
            <button
              role="menuitem"
              onClick={() => { onCopyCode(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04]"
            >
              <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span className="flex-1 text-left">Room Code</span>
              <span className="text-xs text-gold-400 font-mono">{roomCode}</span>
            </button>
          )}

          {/* Game Rules */}
          <button
            role="menuitem"
            onClick={() => { onShowRules?.(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span className="flex-1 text-left">Game Rules</span>
          </button>
        </div>
      )}

    </div>
  );
}
