'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/nextjs';
import { Modal } from '@/components/ui/Modal';
import { useRoomStore } from '@tysiac/game-logic';
import { loadSession, clearSession } from '@/lib/sessionStorage';
import { getSocket } from '@/lib/socket';
import type { StoredSession } from '@/lib/sessionStorage';

const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export function ReconnectModal() {
  const reconnectStatus = useRoomStore((s) => s.reconnectStatus);
  const setReconnectStatus = useRoomStore((s) => s.setReconnectStatus);
  const { getToken } = useAuth();

  const [sessionInfo, setSessionInfo] = useState<StoredSession | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load session info on mount
  useEffect(() => {
    setSessionInfo(loadSession());
  }, []);

  // Re-read session when reconnectStatus changes (it may have been set externally)
  useEffect(() => {
    if (reconnectStatus !== 'idle') {
      setSessionInfo(loadSession());
    }
  }, [reconnectStatus]);

  // Auto-close after success (1.5s delay)
  useEffect(() => {
    if (reconnectStatus !== 'success') return;
    const timer = setTimeout(() => {
      setReconnectStatus('idle');
    }, 1500);
    return () => clearTimeout(timer);
  }, [reconnectStatus, setReconnectStatus]);

  // 10s timeout for reconnecting state
  useEffect(() => {
    if (reconnectStatus !== 'reconnecting') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }
    timeoutRef.current = setTimeout(() => {
      if (useRoomStore.getState().reconnectStatus === 'reconnecting') {
        setReconnectStatus('failed');
      }
    }, 10000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [reconnectStatus, setReconnectStatus]);

  const handleRetry = () => {
    const session = loadSession();
    if (!session) return;
    setReconnectStatus('reconnecting');
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('player:reconnect', {
      roomId: session.roomId,
      playerId: session.playerId,
      sessionToken: session.sessionToken,
    });
  };

  const handleLeave = async () => {
    try {
      const token = await getToken();
      if (token) {
        await fetch(`${API_URL}/active-game`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // not critical
    }
    clearSession();
    setReconnectStatus('idle');
    setSessionInfo(null);
  };

  const isOpen = reconnectStatus !== 'idle' && sessionInfo !== null;

  return (
    <Modal isOpen={isOpen} ariaLabel="Reconnecting to game">
      <div className="w-72 h-44 relative mx-auto">
        <AnimatePresence mode="wait">
          {reconnectStatus === 'reconnecting' && (
            <motion.div
              key="reconnecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-10 h-10 border-2 border-white/20 border-t-gold-400 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-white font-medium">Reconnecting...</p>
                {sessionInfo?.playerName && (
                  <p className="text-white/50 text-sm mt-1">
                    {sessionInfo.playerName}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {reconnectStatus === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-medium">Reconnected!</p>
                <p className="text-white/50 text-sm mt-1">Returning to game...</p>
              </div>
            </motion.div>
          )}

          {reconnectStatus === 'failed' && (
            <motion.div
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-white font-medium">Couldn&apos;t reconnect</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-2 px-3 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/30 text-gold-200 text-sm font-medium transition-colors"
                >
                  Retry
                </button>
                <button
                  onClick={handleLeave}
                  className="flex-1 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm font-medium transition-colors"
                >
                  Leave Game
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
