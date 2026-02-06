'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EmoteType } from '@tysiac/shared';
import { EMOTE_LABELS } from '@tysiac/shared';

interface EmotePanelProps {
  onEmote: (emoteType: EmoteType) => void;
  disabled?: boolean;
}

const QUICK_CHAT_EMOTES: EmoteType[] = [
  'nice-bid',
  'oops',
  'good-game',
  'hurry-up',
  'wow',
  'sorry',
];

const EMOJI_EMOTES: EmoteType[] = [
  '\u{1F44D}',
  '\u{1F602}',
  '\u{1F62E}',
  '\u{1F622}',
  '\u{1F525}',
  '\u{1F480}',
  '\u{1F389}',
  '\u{1F624}',
];

type Tab = 'chat' | 'emoji';

export function EmotePanel({ onEmote, disabled = false }: EmotePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [cooldown, setCooldown] = useState(false);

  const handleEmote = useCallback(
    (emoteType: EmoteType) => {
      if (cooldown || disabled) return;
      onEmote(emoteType);
      setCooldown(true);
      setTimeout(() => setCooldown(false), 2000);
      setIsExpanded(false);
    },
    [cooldown, disabled, onEmote]
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="mb-2 bg-table-900/95 backdrop-blur border border-table-600 rounded-xl shadow-xl overflow-hidden w-[280px]"
          >
            {/* Tab header */}
            <div className="flex border-b border-table-600">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'text-gold-400 border-b-2 border-gold-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Quick Chat
              </button>
              <button
                onClick={() => setActiveTab('emoji')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'emoji'
                    ? 'text-gold-400 border-b-2 border-gold-400'
                    : 'text-white/50 hover:text-white/70'
                }`}
              >
                Emoji
              </button>
            </div>

            {/* Tab content */}
            <div className="p-3">
              {activeTab === 'chat' ? (
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_CHAT_EMOTES.map((emote) => (
                    <button
                      key={emote}
                      onClick={() => handleEmote(emote)}
                      disabled={cooldown || disabled}
                      className="px-3 py-2.5 text-sm font-medium rounded-lg bg-table-800/80 border border-table-600 text-white hover:bg-table-700 hover:border-gold-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-table-800/80 disabled:hover:border-table-600"
                    >
                      {EMOTE_LABELS[emote]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {EMOJI_EMOTES.map((emote) => (
                    <button
                      key={emote}
                      onClick={() => handleEmote(emote)}
                      disabled={cooldown || disabled}
                      className="p-2.5 text-2xl rounded-lg bg-table-800/80 border border-table-600 hover:bg-table-700 hover:border-gold-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-table-800/80 disabled:hover:border-table-600"
                    >
                      {emote}
                    </button>
                  ))}
                </div>
              )}

              {cooldown && (
                <div className="mt-2 text-center text-xs text-white/40">
                  Wait a moment before sending another...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsExpanded((prev) => !prev)}
        disabled={disabled}
        className="w-12 h-12 rounded-full bg-table-800/90 border border-table-600 text-xl shadow-lg hover:bg-table-700 hover:border-gold-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isExpanded ? '\u2715' : '\u{1F4AC}'}
      </motion.button>
    </div>
  );
}
