'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRoomStore } from '@/stores/roomStore';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const { isConnected, isConnecting, error } = useRoomStore();

  return (
    <AnimatePresence>
      {(!isConnected || error) && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-50',
            'flex items-center justify-center gap-2 py-2',
            'text-sm font-medium',
            isConnecting
              ? 'bg-yellow-500/90 text-yellow-950'
              : error
              ? 'bg-red-500/90 text-white'
              : 'bg-orange-500/90 text-white'
          )}
        >
          {isConnecting ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-yellow-950/30 border-t-yellow-950 rounded-full"
              />
              Connecting to server...
            </>
          ) : error ? (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </>
          ) : (
            <>
              <div className="w-2 h-2 bg-orange-200 rounded-full animate-pulse" />
              Reconnecting...
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
