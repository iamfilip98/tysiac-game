'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface QuickPlayButtonProps {
  onJoin: () => void;
  onCancel: () => void;
  isSearching: boolean;
  searchPlayerCount: number;
  isConnected: boolean;
  disabled?: boolean;
}

export function QuickPlayButton({
  onJoin,
  onCancel,
  isSearching,
  searchPlayerCount,
  isConnected,
  disabled,
}: QuickPlayButtonProps) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative w-16 h-16">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-gold-500/30"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-gold-500/30"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.svg
              className="w-8 h-8 text-gold-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
            </motion.svg>
          </div>
        </div>

        <div className="text-center">
          <p className="text-white font-medium text-lg">Searching for players...</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className={cn(
                  'w-3 h-3 rounded-full transition-colors duration-300',
                  i < searchPlayerCount ? 'bg-gold-500' : 'bg-white/20'
                )}
                animate={i < searchPlayerCount ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              />
            ))}
            <span className="text-white/60 text-sm ml-2">
              {searchPlayerCount}/3
            </span>
          </div>
          <p className="text-white/40 text-xs mt-3">
            AI will fill empty spots after 30 seconds
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="mt-2"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center h-full py-2">
      <p className="text-white/40 text-xs text-center mb-3">
        Find a match instantly. AI fills empty spots after 30s.
      </p>
      <div className="flex-1" />
      <Button
        variant="primary"
        className="w-full"
        disabled={!isConnected || disabled}
        glow
        onClick={onJoin}
      >
        {!isConnected ? 'Waiting for connection...' : 'Quick Play'}
      </Button>
    </div>
  );
}
