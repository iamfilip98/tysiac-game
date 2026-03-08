'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@tysiac/game-logic';
import { getSuitSymbol, getSuitColor } from '@tysiac/shared';
import type { TrickHistoryEntry } from '@tysiac/game-logic';

interface TrickHistoryButtonProps {
  players: { id: string; name: string }[];
}

function TrickCard({ suit, rank, isTrump, isMarriage }: { suit: string; rank: string; isTrump?: boolean; isMarriage?: boolean }) {
  // Gold for marriage, blue for trump, otherwise normal suit colors
  const colorClass = isMarriage
    ? 'text-gold-400'
    : isTrump
    ? 'text-blue-400'
    : getSuitColor(suit) === 'red'
    ? 'text-red-400'
    : 'text-white/90';

  return (
    <span className={colorClass}>
      {rank}{getSuitSymbol(suit)}
    </span>
  );
}

function TrickRow({ entry, players }: { entry: TrickHistoryEntry; players: { id: string; name: string }[] }) {
  const getName = (id: string) => {
    const p = players.find(pl => pl.id === id);
    return p?.name ?? '?';
  };

  const leadSuit = entry.cards[0]?.card.suit;
  const marriagePlayerId = entry.marriageDeclared?.playerId;
  const marriageSuit = entry.marriageDeclared?.suit;

  return (
    <div className="px-3 py-2 border-b border-white/[0.06] last:border-b-0">
      <div className="text-[10px] text-white/40 font-medium mb-1">Trick {entry.trickNumber}</div>
      <div className="space-y-0.5">
        {entry.cards.map((c, i) => {
          const isWinner = c.playerId === entry.winnerId;
          const isTrump = !!(entry.trumpSuit && c.card.suit === entry.trumpSuit && c.card.suit !== leadSuit);
          const isMarriage = !!(marriagePlayerId === c.playerId && marriageSuit && (c.card.rank === 'Q' || c.card.rank === 'K') && c.card.suit === marriageSuit);
          return (
            <div key={i} className={`flex items-center gap-2 text-xs ${isWinner ? 'font-semibold' : 'opacity-70'}`}>
              <span className="truncate max-w-[80px] text-white/80">{getName(c.playerId)}</span>
              <TrickCard suit={c.card.suit} rank={c.card.rank} isTrump={isTrump} isMarriage={isMarriage} />
              {isWinner && <span className="text-gold-400 text-[10px]">W</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TrickHistoryButton({ players }: TrickHistoryButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; right: number } | null>(null);
  const trickHistory = useGameStore((s) => s.trickHistory);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPopupPos({
      top: rect.top + rect.height / 2,
      right: window.innerWidth - rect.left + 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        popupRef.current?.contains(target)
      ) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className="btn-toolbar min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5 relative"
        title="Trick history"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {trickHistory.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-gold-500 text-black text-[10px] font-bold flex items-center justify-center px-1">
            {trickHistory.length}
          </span>
        )}
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && popupPos && (
            <motion.div
              ref={popupRef}
              role="dialog"
              aria-label="Trick history"
              initial={{ opacity: 0, scale: 0.85, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: 8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[9999] bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.12] rounded-xl shadow-xl overflow-hidden"
              style={{
                top: popupPos.top,
                right: popupPos.right,
                transform: 'translateY(-50%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.5)',
                maxHeight: '320px',
                width: '220px',
              }}
            >
              <div className="px-3 py-2 border-b border-white/[0.1]">
                <span className="text-xs font-semibold text-white/60 tracking-wide uppercase">Trick History</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
                {trickHistory.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-white/40">
                    No tricks played yet
                  </div>
                ) : (
                  trickHistory.map((entry) => (
                    <TrickRow key={entry.trickNumber} entry={entry} players={players} />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
