'use client';

import { useState, useRef, useEffect } from 'react';
import type { PlayerStatsPublic } from '@tysiac/shared';

interface UserBadgeProps {
  displayName: string;
  stats: PlayerStatsPublic | null;
  onLogout: () => void;
}

export function UserBadge({ displayName, stats, onLogout }: UserBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
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
        title={displayName}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="w-[18px] h-[18px] rounded-full bg-gold-500/30 text-gold-400 flex items-center justify-center text-[11px] font-bold leading-none ring-1 ring-gold-500/40">
          {displayName[0]?.toUpperCase() || '?'}
        </span>
        <span className="hidden sm:inline">{displayName}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full mt-1 w-52 bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.12] rounded-lg shadow-xl z-50 py-1"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.5)' }}
        >
          {/* Player info header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <div className="text-sm font-medium text-white truncate">{displayName}</div>
            {stats && (
              <div className="text-xs text-white/40 mt-0.5">
                {stats.rating} rating
                {stats.gamesPlayed > 0 && (
                  <span className="ml-1.5">{stats.winRate}% wins</span>
                )}
              </div>
            )}
          </div>

          {/* Stats rows */}
          {stats && stats.gamesPlayed > 0 && (
            <div className="px-3 py-2 border-b border-white/[0.04] space-y-1">
              <div className="flex justify-between text-[12px]">
                <span className="text-white/50">Games</span>
                <span className="text-white/80">{stats.gamesPlayed}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-white/50">Won / Lost</span>
                <span className="text-white/80">{stats.gamesWon} / {stats.gamesLost}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-white/50">Win streak</span>
                <span className="text-white/80">{stats.currentWinStreak}</span>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            role="menuitem"
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-3 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="flex-1 text-left">Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
