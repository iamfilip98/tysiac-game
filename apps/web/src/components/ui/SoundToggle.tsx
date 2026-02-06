'use client';

import { useState, useCallback } from 'react';
import { soundManager } from '@/lib/sounds';

interface SoundToggleProps {
  className?: string;
}

export default function SoundToggle({ className = '' }: SoundToggleProps) {
  const [muted, setMuted] = useState(() => soundManager.isMuted());
  const [hasInitialized, setHasInitialized] = useState(false);

  const handleClick = useCallback(async () => {
    if (!hasInitialized) {
      await soundManager.initialize();
      setHasInitialized(true);
    }
    const nowMuted = soundManager.toggleMute();
    setMuted(nowMuted);
  }, [hasInitialized]);

  return (
    <button
      onClick={handleClick}
      className={`text-white/60 hover:text-white transition-colors ${className}`}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
    >
      {muted ? (
        // Speaker with X (muted)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        // Speaker with waves (unmuted)
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      )}
    </button>
  );
}
