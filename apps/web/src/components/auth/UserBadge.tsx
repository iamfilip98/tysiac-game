'use client';

interface UserBadgeProps {
  displayName: string;
  onProfileClick: () => void;
}

export function UserBadge({ displayName, onProfileClick }: UserBadgeProps) {
  return (
    <button
      onClick={onProfileClick}
      className="btn-toolbar min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5"
      title={displayName}
    >
      <span className="w-[18px] h-[18px] rounded-full bg-gold-500/30 text-gold-400 flex items-center justify-center text-[11px] font-bold leading-none ring-1 ring-gold-500/40">
        {displayName[0]?.toUpperCase() || '?'}
      </span>
      <span className="hidden sm:inline">{displayName}</span>
    </button>
  );
}
