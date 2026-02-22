'use client';

import { useState, useRef, useEffect } from 'react';

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
  const ref = useRef<HTMLDivElement>(null);

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

      {open && (
        <div
          role="menu"
          aria-label="Emotes"
          className="absolute left-0 bottom-full mb-1 bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg border border-white/[0.12] rounded-lg shadow-xl z-50 p-2"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 40px rgba(0,0,0,0.5)' }}
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
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-md hover:bg-white/[0.08] transition-colors min-w-[56px]"
              >
                <span className="text-xl leading-none">{emote.emoji}</span>
                <span className="text-[10px] text-white/50 leading-none">{emote.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Export emote lookup for use in EmoteBubble
export const EMOTE_MAP: Record<string, { emoji: string; label: string }> = Object.fromEntries(
  EMOTES.map((e) => [e.id, { emoji: e.emoji, label: e.label }])
);
