'use client';

import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';
import { usePreferencesStore, type Theme, type CardStyle } from '@tysiac/game-logic';
import type { PlayerStatsPublic } from '@tysiac/shared';

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

const AVATAR_EMOJIS = [
  '\u2660', '\u2665', '\u2666', '\u2663', '\uD83D\uDC51', '\uD83C\uDFAF',
  '\uD83C\uDFB2', '\uD83C\uDCCF', '\uD83E\uDD8A', '\uD83D\uDC3A',
  '\uD83E\uDD81', '\uD83D\uDC3B', '\uD83E\uDD85', '\uD83D\uDC09',
  '\u2B50', '\uD83D\uDD25',
];

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  displayName: string;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  onAvatarChange?: (emoji: string | null) => void;
  onNameChange?: (name: string) => void;
  stats: PlayerStatsPublic | null;
  onLogout: () => void;
  onSignUp: () => void;
  onShowRules?: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  isAuthenticated,
  displayName,
  avatarUrl,
  avatarEmoji,
  onAvatarChange,
  onNameChange,
  stats,
  onLogout,
  onSignUp,
  onShowRules,
}: ProfileModalProps) {
  const {
    theme,
    soundEnabled,
    animationsEnabled,
    cardStyle,
    emotesEnabled,
    toggleTheme,
    toggleSound,
    toggleAnimations,
    toggleCardStyle,
    toggleEmotes,
  } = usePreferencesStore();

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Profile">
      <ModalHeader onClose={onClose}>Profile</ModalHeader>
      <ModalBody>
        {/* Profile header */}
        <div className="flex items-center gap-3 mb-4">
          {avatarUrl && !avatarEmoji ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full ring-2 ring-gold-500/40"
            />
          ) : avatarEmoji ? (
            <div className="w-12 h-12 rounded-full bg-gold-500/20 ring-2 ring-gold-500/40 flex items-center justify-center text-2xl">
              {avatarEmoji}
            </div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-gold-500/20 ring-2 ring-gold-500/40 flex items-center justify-center text-gold-400 text-lg font-bold">
              {displayName[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isAuthenticated ? (
              <>
                <div className="text-white font-semibold">{displayName}</div>
                {stats ? (
                  <div className="text-sm text-white/50">{stats.rating} rating</div>
                ) : null}
              </>
            ) : (
              <input
                type="text"
                value={displayName === 'Guest' ? '' : displayName}
                onChange={(e) => onNameChange?.(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/30"
              />
            )}
          </div>
        </div>

        {/* Avatar picker */}
        <div className="mb-4">
          <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Avatar</div>
          <div className="grid grid-cols-8 gap-1.5">
            {/* Clear option */}
            <button
              onClick={() => onAvatarChange?.(null)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all ${
                !avatarEmoji
                  ? 'bg-gold-500/20 ring-2 ring-gold-500/50'
                  : 'bg-white/[0.06] hover:bg-white/[0.1]'
              }`}
              title="Default"
            >
              <span className="text-white/50 text-[10px] font-bold">
                {displayName[0]?.toUpperCase() || '?'}
              </span>
            </button>
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onAvatarChange?.(emoji)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                  avatarEmoji === emoji
                    ? 'bg-gold-500/20 ring-2 ring-gold-500/50'
                    : 'bg-white/[0.06] hover:bg-white/[0.1]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Stats grid — authenticated users with games played */}
        {isAuthenticated && stats && stats.gamesPlayed > 0 && (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5">
              <StatRow label="Games" value={stats.gamesPlayed} />
              <StatRow label="Wins" value={stats.gamesWon} />
              <StatRow label="Win Rate" value={`${stats.winRate}%`} />
              <StatRow label="Rating" value={stats.rating} highlight />
              <StatRow label="Win Streak" value={stats.currentWinStreak} />
              <StatRow label="Best Streak" value={stats.longestWinStreak} />
              <StatRow label="Marriages" value={stats.totalMarriages} />
              <StatRow label="Bids Won" value={stats.totalBidsWon} />
              <StatRow label="Highest Score" value={stats.highestGameScore} />
              <StatRow label="Bids Failed" value={stats.totalBidsFailed} />
            </div>
            <div className="border-t border-white/[0.06] mb-5" />
          </>
        )}

        {/* Settings section */}
        <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Settings</div>
        <div className="space-y-0.5 mb-4">
          <SettingsRow
            icon={
              soundEnabled ? (
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
              )
            }
            label="Sound"
            value={soundEnabled ? 'On' : 'Off'}
            active={soundEnabled}
            onClick={toggleSound}
          />
          <SettingsRow
            icon={
              <>
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </>
            }
            label="Theme"
            value={THEME_LABELS[theme]}
            active
            onClick={toggleTheme}
          />
          <SettingsRow
            icon={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
            label="Animations"
            value={animationsEnabled ? 'On' : 'Off'}
            active={animationsEnabled}
            onClick={toggleAnimations}
          />
          <SettingsRow
            icon={
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8 L13.5 11.5 L12 15 L10.5 11.5 Z" fill="currentColor" opacity="0.5" />
              </>
            }
            label="Cards"
            value={CARD_STYLE_LABELS[cardStyle]}
            active
            onClick={toggleCardStyle}
          />
          <SettingsRow
            icon={
              <>
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </>
            }
            label="Emotes"
            value={emotesEnabled ? 'On' : 'Off'}
            active={emotesEnabled}
            onClick={toggleEmotes}
          />
        </div>

        {/* Game Rules */}
        {onShowRules && (
          <button
            onClick={() => { onShowRules(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors rounded-lg mb-4"
          >
            <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span className="flex-1 text-left">Game Rules</span>
          </button>
        )}

        <div className="border-t border-white/[0.06] mb-4" />

        {/* Action button */}
        {isAuthenticated ? (
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        ) : (
          <div className="text-center">
            <p className="text-sm text-white/50 mb-3">Sign up to track your stats and rating</p>
            <button
              onClick={() => { onSignUp(); onClose(); }}
              className="w-full px-4 py-2.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-black font-semibold text-sm transition-colors"
            >
              Create Account
            </button>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-white/50">{label}</span>
      <span className={highlight ? 'text-gold-400 font-semibold' : 'text-white/80'}>{value}</span>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-white/85 hover:bg-white/[0.06] transition-colors rounded-lg"
    >
      <svg className="w-4 h-4 text-white/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      <span className="flex-1 text-left">{label}</span>
      <span className={`text-xs ${active ? 'text-gold-400' : 'text-white/40'}`}>{value}</span>
    </button>
  );
}
