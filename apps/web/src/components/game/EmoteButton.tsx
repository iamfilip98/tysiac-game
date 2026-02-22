'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const EMOTES = [
  { id: 'thumbsup', emoji: '\u{1F44D}', label: 'Nice' },
  { id: 'haha', emoji: '\u{1F602}', label: 'Haha' },
  { id: 'wow', emoji: '\u{1F62E}', label: 'Wow' },
  { id: 'oops', emoji: '\u{1F622}', label: 'Oops' },
  { id: 'gg', emoji: '\u{1F389}', label: 'GG' },
  { id: 'hmm', emoji: '\u{1F914}', label: 'Hmm' },
] as const;

interface EmoteButtonProps {
  sendEmote: (emoteId: string) => void;
}

export function EmoteButton({ sendEmote }: EmoteButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Position to the right of the button, vertically centered
    setPopupPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
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
        className="btn-toolbar min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5"
        title="Send emote"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && popupPos && (
            <motion.div
              ref={popupRef}
              role="menu"
              aria-label="Emotes"
              initial={{ opacity: 0, scale: 0.85, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85, x: -8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="fixed z-[9999] bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.12] rounded-xl shadow-xl p-2"
              style={{
                top: popupPos.top,
                left: popupPos.left,
                transform: 'translateY(-50%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.5)',
              }}
            >
              <div className="grid grid-cols-3 gap-1">
                {EMOTES.map((emote) => (
                  <button
                    key={emote.id}
                    role="menuitem"
                    onClick={() => {
                      sendEmote(emote.id);
                      setOpen(false);
                    }}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-white/[0.1] active:bg-white/[0.15] active:scale-95 transition-all min-w-[56px]"
                  >
                    <span className="text-2xl leading-none select-none">{emote.emoji}</span>
                    <span className="text-[10px] text-white/50 leading-none">{emote.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// Export emote lookup for use in EmoteBubble
export const EMOTE_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  EMOTES.map((e) => [e.id, { emoji: e.emoji, label: e.label }])
);
