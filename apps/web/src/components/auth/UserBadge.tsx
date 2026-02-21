'use client';

import { cn } from '@/lib/utils';
import type { PlayerStatsPublic } from '@tysiac/shared';

interface UserBadgeProps {
  displayName: string;
  stats: PlayerStatsPublic | null;
  onLogout: () => void;
}

export function UserBadge({ displayName, stats, onLogout }: UserBadgeProps) {
  return (
    <div className="flex items-center gap-3 bg-table-800/80 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-2">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gold-500/20 text-gold-400 flex items-center justify-center font-bold text-sm ring-1 ring-gold-500/30">
        {displayName[0]?.toUpperCase() || '?'}
      </div>

      {/* Name + mini stat */}
      <div className="min-w-0">
        <div className="text-sm font-medium text-white truncate max-w-[120px]">
          {displayName}
        </div>
        {stats && (
          <div className="text-xs text-white/40">
            {stats.rating} rating
            {stats.gamesPlayed > 0 && (
              <span className="ml-1.5">{stats.winRate}% wins</span>
            )}
          </div>
        )}
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="text-white/30 hover:text-white/60 transition-colors ml-1"
        aria-label="Log out"
        title="Log out"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}
