'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePreferencesStore } from '@tysiac/game-logic';

type TutorialPhase =
  | 'dealing'
  | 'bidding'
  | 'talonReveal'
  | 'talonDistribution'
  | 'trickPlaying'
  | 'roundScoring'
  | 'complete';

interface HintContent {
  title: string;
  description: string;
}

const HINTS: Record<TutorialPhase, HintContent> = {
  dealing: {
    title: 'Welcome!',
    description:
      'Cards are being dealt. You\'ll get 7 cards, and 3 cards go to the talon (face-down in the center).',
  },
  bidding: {
    title: 'Bidding Phase',
    description:
      'Bid to win the talon (3 hidden cards). The minimum bid is 100. Bid higher if you have King + Queen pairs (marriages)! You can also pass.',
  },
  talonReveal: {
    title: 'Talon Revealed!',
    description:
      'The bid winner gets to see the 3 talon cards. They\'ll be added to the winner\'s hand.',
  },
  talonDistribution: {
    title: 'Give Away Cards',
    description:
      'Now give 1 card to each opponent. Tap a card, then tap an opponent to give it. Keep your best cards!',
  },
  trickPlaying: {
    title: 'Playing Tricks',
    description:
      'Play a card to win tricks. You must follow suit if you can. Try to beat the highest card in the trick!',
  },
  roundScoring: {
    title: 'Round Complete!',
    description:
      'Your trick points are tallied. The bidder needs to meet their bid or lose those points. First to 1000 wins!',
  },
  complete: {
    title: 'You\'re Ready!',
    description:
      'You know the basics of Tysiąc. Go play a real game — good luck!',
  },
};

const PHASE_ORDER: TutorialPhase[] = [
  'dealing',
  'bidding',
  'talonReveal',
  'talonDistribution',
  'trickPlaying',
  'roundScoring',
  'complete',
];

interface TutorialOverlayProps {
  phase: string | undefined;
  isMyTurn: boolean;
  completedTricks?: number;
}

export function TutorialOverlay({ phase, isMyTurn, completedTricks }: TutorialOverlayProps) {
  const [shownHints, setShownHints] = useState<Set<TutorialPhase>>(new Set());
  const [currentHint, setCurrentHint] = useState<TutorialPhase | null>(null);
  const [visible, setVisible] = useState(false);
  const setTutorialCompleted = usePreferencesStore((s) => s.setTutorialCompleted);

  // Map game phase to tutorial phase, considering context
  const getTutorialPhase = useCallback((): TutorialPhase | null => {
    if (!phase) return null;

    switch (phase) {
      case 'dealing':
        return 'dealing';
      case 'bidding':
        return isMyTurn ? 'bidding' : null;
      case 'talonReveal':
        return 'talonReveal';
      case 'talonDistribution':
        return isMyTurn ? 'talonDistribution' : null;
      case 'trickPlaying':
        // Only show on first trick
        return (completedTricks ?? 0) === 0 && isMyTurn ? 'trickPlaying' : null;
      case 'roundScoring':
        return 'roundScoring';
      default:
        return null;
    }
  }, [phase, isMyTurn, completedTricks]);

  // Show hint when phase changes
  useEffect(() => {
    const tutorialPhase = getTutorialPhase();
    if (!tutorialPhase || shownHints.has(tutorialPhase)) {
      // Phase changed — dismiss current hint if it doesn't match
      if (currentHint && currentHint !== tutorialPhase) {
        setVisible(false);
      }
      return;
    }

    // Delay showing the next hint
    const timer = setTimeout(() => {
      setCurrentHint(tutorialPhase);
      setVisible(true);
    }, 600);

    return () => clearTimeout(timer);
  }, [getTutorialPhase, shownHints, currentHint]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (currentHint) {
      setShownHints((prev) => new Set(prev).add(currentHint));

      // After roundScoring, show completion
      if (currentHint === 'roundScoring') {
        setTimeout(() => {
          setCurrentHint('complete');
          setVisible(true);
        }, 400);
      }
    }
  }, [currentHint]);

  const dismissComplete = useCallback(() => {
    setVisible(false);
    setShownHints((prev) => new Set(prev).add('complete'));
    setTutorialCompleted(true);
  }, [setTutorialCompleted]);

  const hint = currentHint ? HINTS[currentHint] : null;
  const stepIndex = currentHint ? PHASE_ORDER.indexOf(currentHint) : -1;

  return (
    <AnimatePresence>
      {visible && hint && (
        <>
          {/* Semi-transparent backdrop — doesn't block interaction */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-40 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 100%)' }}
          />

          {/* Hint card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="absolute left-1/2 -translate-x-1/2 top-[38%] -translate-y-1/2 z-50 w-[min(90vw,340px)]"
          >
            <div
              className="rounded-xl border border-gold-500/40 bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-lg p-5 shadow-xl"
              style={{ boxShadow: '0 0 30px rgba(251,191,36,0.15), inset 0 1px 0 rgba(255,255,255,0.08)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-500/15 border border-gold-500/25">
                  <svg className="w-4.5 h-4.5 text-gold-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18h6" />
                    <path d="M10 22h4" />
                    <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                  </svg>
                </div>
                <h3 className="text-gold-400 font-semibold text-base">{hint.title}</h3>
              </div>

              {/* Description */}
              <p className="text-white/80 text-sm leading-relaxed mb-4">
                {hint.description}
              </p>

              {/* Footer: step dots + dismiss button */}
              <div className="flex items-center justify-between">
                {/* Step dots */}
                <div className="flex gap-1.5">
                  {PHASE_ORDER.map((p, i) => (
                    <div
                      key={p}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === stepIndex
                          ? 'bg-gold-400'
                          : i < stepIndex
                          ? 'bg-gold-400/40'
                          : 'bg-white/15'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={currentHint === 'complete' ? dismissComplete : dismiss}
                  className="px-4 py-1.5 rounded-lg bg-gold-500/15 border border-gold-500/30 text-gold-400 text-sm font-medium hover:bg-gold-500/25 transition-colors"
                >
                  {currentHint === 'complete' ? 'Let\'s go!' : 'Got it'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
