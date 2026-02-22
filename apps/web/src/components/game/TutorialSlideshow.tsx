'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitColor, SUITS, RANKS, MARRIAGE_VALUES } from '@tysiac/shared';
import type { Card as CardType, Suit, Rank } from '@tysiac/shared';
import { Card } from './Card';
import { useIsMobile } from '@/hooks/useIsMobile';

function c(suit: Suit, rank: Rank): CardType {
  return { suit, rank };
}

// --- Slide components ---

function SlideDeck({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  return (
    <div className="space-y-3">
      {SUITS.map((suit) => (
        <div key={suit} className="flex justify-center gap-1">
          {RANKS.map((rank) => (
            <Card
              key={`${rank}${suit}`}
              card={c(suit, rank)}
              size={cardSize}
              isPlayable={false}
              skipEntryAnimation
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SlideValues({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  const groups: { points: string; ranks: Rank[] }[] = [
    { points: '11 pts', ranks: ['A'] },
    { points: '10 pts', ranks: ['10'] },
    { points: '4 pts', ranks: ['K'] },
    { points: '3 pts', ranks: ['Q'] },
    { points: '2 pts', ranks: ['J'] },
    { points: '0 pts', ranks: ['9'] },
  ];
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.points} className="flex items-center gap-3 justify-center">
          <div className="flex gap-1">
            {g.ranks.map((rank) => (
              <Card
                key={rank}
                card={c('hearts', rank)}
                size={cardSize}
                isPlayable={false}
                skipEntryAnimation
              />
            ))}
          </div>
          <span className="text-gold-400 font-semibold text-sm w-14">{g.points}</span>
        </div>
      ))}
      <p className="text-white/50 text-xs text-center mt-2">Total per round: 120 points</p>
    </div>
  );
}

function FannedCards({ count, cardSize }: { count: number; cardSize: 'xs' | 'sm' }) {
  const offset = cardSize === 'xs' ? 14 : 16;
  const width = offset * (count - 1) + (cardSize === 'xs' ? 48 : 56);
  return (
    <div className="relative" style={{ width, height: cardSize === 'xs' ? 72 : 84 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="absolute top-0" style={{ left: i * offset }}>
          <Card card={c('spades', '9')} size={cardSize} isFaceDown isPlayable={false} skipEntryAnimation />
        </div>
      ))}
    </div>
  );
}

function SlideDealing({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  const yourHand: CardType[] = [
    c('hearts', 'A'), c('hearts', 'K'), c('diamonds', 'Q'),
    c('clubs', '10'), c('clubs', 'J'), c('spades', 'K'), c('spades', '9'),
  ];
  return (
    <div className="space-y-3">
      <div>
        <p className="text-white/60 text-xs text-center mb-1.5">Your hand (7 cards)</p>
        <div className="flex justify-center gap-1 flex-wrap">
          {yourHand.map((card) => (
            <Card key={`${card.rank}${card.suit}`} card={card} size={cardSize} isPlayable={false} skipEntryAnimation />
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-6">
        <div className="flex flex-col items-center">
          <p className="text-white/60 text-xs text-center mb-1.5">Opponent 1 (7)</p>
          <FannedCards count={7} cardSize={cardSize} />
        </div>
        <div className="flex flex-col items-center">
          <p className="text-white/60 text-xs text-center mb-1.5">Opponent 2 (7)</p>
          <FannedCards count={7} cardSize={cardSize} />
        </div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-white/60 text-xs text-center mb-1.5">Talon (3 hidden)</p>
        <div className="flex justify-center gap-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} card={c('spades', '9')} size={cardSize} isFaceDown isPlayable={false} skipEntryAnimation />
          ))}
        </div>
      </div>
    </div>
  );
}

function SlideBidding() {
  const steps = [
    { player: 'You', bid: '100', active: false },
    { player: 'Opp 1', bid: '110', active: false },
    { player: 'Opp 2', bid: '120', active: true },
    { player: 'You', bid: 'Pass', active: false },
    { player: 'Opp 1', bid: 'Pass', active: false },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 items-center">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-white/50 text-xs w-12 text-right">{s.player}</span>
            <div
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-semibold min-w-[72px] text-center',
                s.bid === 'Pass'
                  ? 'bg-white/10 text-white/40'
                  : s.active
                    ? 'bg-gold-500/30 text-gold-300 ring-1 ring-gold-500/50'
                    : 'bg-white/10 text-white/70'
              )}
            >
              {s.bid}
            </div>
            {i < steps.length - 1 && (
              <span className="text-white/30 text-xs">&#x2193;</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-white/50 text-xs text-center">
        Minimum bid: 100. Increases by 10. Highest bidder wins the talon.
      </p>
    </div>
  );
}

function SlideTalon({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  const talonCards: CardType[] = [c('hearts', 'Q'), c('diamonds', 'A'), c('clubs', '9')];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-white/60 text-xs text-center mb-1.5">Talon revealed to bid winner</p>
        <div className="flex justify-center gap-2">
          {talonCards.map((card) => (
            <Card key={`${card.rank}${card.suit}`} card={card} size={cardSize} isPlayable={false} skipEntryAnimation />
          ))}
        </div>
      </div>
      <div className="flex justify-center items-center gap-2 text-white/40">
        <span className="text-lg">&#x2193;</span>
      </div>
      <div className="flex justify-center gap-8">
        <div className="text-center">
          <p className="text-white/60 text-xs mb-1.5">Give to Opp 1</p>
          <Card card={c('clubs', '9')} size={cardSize} isPlayable={false} skipEntryAnimation />
        </div>
        <div className="text-center">
          <p className="text-white/60 text-xs mb-1.5">Keep</p>
          <div className="flex gap-1">
            <Card card={c('hearts', 'Q')} size={cardSize} isPlayable={false} skipEntryAnimation />
            <Card card={c('diamonds', 'A')} size={cardSize} isPlayable={false} skipEntryAnimation />
          </div>
        </div>
        <div className="text-center">
          <p className="text-white/60 text-xs mb-1.5">Give to Opp 2</p>
          <Card card={c('clubs', '9')} size={cardSize} isPlayable={false} skipEntryAnimation />
        </div>
      </div>
      <p className="text-white/50 text-xs text-center">
        Pick up 3, keep 1, give 1 to each opponent. You play with 8 cards.
      </p>
    </div>
  );
}

function SlideMarriages({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  const marriages: { suit: Suit; value: number }[] = [
    { suit: 'hearts', value: MARRIAGE_VALUES.hearts },
    { suit: 'diamonds', value: MARRIAGE_VALUES.diamonds },
    { suit: 'clubs', value: MARRIAGE_VALUES.clubs },
    { suit: 'spades', value: MARRIAGE_VALUES.spades },
  ];
  return (
    <div className="space-y-3">
      {marriages.map((m) => {
        const symbol = getSuitSymbol(m.suit);
        const color = getSuitColor(m.suit);
        return (
          <div key={m.suit} className="flex items-center justify-center gap-3">
            <div className="flex gap-1">
              <Card card={c(m.suit, 'K')} size={cardSize} isPlayable={false} isMarriageCard skipEntryAnimation />
              <Card card={c(m.suit, 'Q')} size={cardSize} isPlayable={false} isMarriageCard skipEntryAnimation />
            </div>
            <span className={cn('text-sm font-semibold', color === 'red' ? 'text-red-400' : 'text-white/80')}>
              {symbol} {m.value} pts
            </span>
          </div>
        );
      })}
      <p className="text-white/50 text-xs text-center mt-2">
        Play the Queen when leading a trick to declare. Sets that suit as trump.
      </p>
    </div>
  );
}

function SlideTricks({ cardSize }: { cardSize: 'xs' | 'sm' }) {
  const trick: { card: CardType; label: string; highlight?: boolean }[] = [
    { card: c('hearts', '10'), label: 'Led' },
    { card: c('hearts', 'K'), label: 'Followed' },
    { card: c('hearts', 'A'), label: 'Wins!', highlight: true },
  ];
  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-4">
        {trick.map((t, i) => (
          <div key={i} className="text-center">
            <Card
              card={t.card}
              size={cardSize}
              isPlayable={false}
              className={t.highlight ? 'ring-2 ring-gold-400' : ''}
              skipEntryAnimation
            />
            <p className={cn('text-xs mt-1.5', t.highlight ? 'text-gold-400 font-semibold' : 'text-white/50')}>
              {t.label}
            </p>
          </div>
        ))}
      </div>
      <div className="text-white/60 text-xs space-y-1 text-center">
        <p>You <span className="text-white">must follow suit</span> if you can</p>
        <p>If the lead card is winning, you <span className="text-white">must try to beat it</span></p>
        <p>Can&apos;t follow suit? Play any card</p>
        <p>Trump suit beats all non-trump cards</p>
      </div>
    </div>
  );
}

function SlideScoring() {
  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-lg p-3 space-y-2">
        <p className="text-white/60 text-xs">Example round:</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Your bid</span>
          <span className="text-gold-400 font-semibold">120</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Tricks + marriages won</span>
          <span className="text-green-400 font-semibold">130</span>
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/70">Score this round</span>
          <span className="text-green-400 font-semibold">+130</span>
        </div>
        <p className="text-white/40 text-xs">Met your bid? Score what you earned (rounded to 10).</p>
      </div>

      <div className="space-y-2">
        <p className="text-white/60 text-xs text-center">Progress to 1000</p>
        <div className="relative h-6 bg-white/10 rounded-full overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-600 to-green-500 rounded-full" style={{ width: '65%' }} />
          <div className="absolute inset-y-0 right-0 bg-red-500/20 rounded-r-full" style={{ width: '20%' }} />
          <span className="absolute right-[21%] top-0 bottom-0 w-px bg-red-400/60" />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">
            650 / 1000
          </span>
        </div>
        <div className="flex justify-between text-xs text-white/40 px-1">
          <span>0</span>
          <span className="text-red-400/80">800 (Barrel)</span>
          <span>1000</span>
        </div>
      </div>

      <p className="text-white/50 text-xs text-center">
        At 800+ you&apos;re on the barrel &mdash; you must bid and reach 1000 or lose points.
        First to 1000 wins!
      </p>
    </div>
  );
}

// --- Slide data ---

interface SlideData {
  title: string;
  content: (cardSize: 'xs' | 'sm') => React.ReactNode;
}

const SLIDES: SlideData[] = [
  {
    title: 'The Deck',
    content: (s) => <SlideDeck cardSize={s} />,
  },
  {
    title: 'Card Values',
    content: (s) => <SlideValues cardSize={s} />,
  },
  {
    title: 'Dealing',
    content: (s) => <SlideDealing cardSize={s} />,
  },
  {
    title: 'Bidding',
    content: () => <SlideBidding />,
  },
  {
    title: 'Talon & Distribution',
    content: (s) => <SlideTalon cardSize={s} />,
  },
  {
    title: 'Marriages',
    content: (s) => <SlideMarriages cardSize={s} />,
  },
  {
    title: 'Playing Tricks',
    content: (s) => <SlideTricks cardSize={s} />,
  },
  {
    title: 'Scoring & Winning',
    content: () => <SlideScoring />,
  },
];

// --- Navigation variants ---

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

// --- Main component ---

export function TutorialSlideshow() {
  const isMobile = useIsMobile();
  const cardSize = isMobile ? 'xs' as const : 'sm' as const;
  const [[page, direction], setPage] = useState([0, 0]);
  const touchStartX = useRef<number | null>(null);

  const paginate = useCallback(
    (newDirection: number) => {
      setPage(([prev]) => {
        const next = prev + newDirection;
        if (next < 0 || next >= SLIDES.length) return [prev, 0];
        return [next, newDirection];
      });
    },
    [],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        paginate(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        paginate(-1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [paginate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      paginate(diff > 0 ? 1 : -1);
    }
    touchStartX.current = null;
  };

  const slide = SLIDES[page];

  return (
    <div className="space-y-4">
      {/* Slide counter */}
      <p className="text-white/40 text-xs text-center">
        {page + 1} / {SLIDES.length}
      </p>

      {/* Slide content area — fixed height prevents modal resizing between slides */}
      <div
        className="relative overflow-hidden h-[420px] sm:h-[460px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={page}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0 flex flex-col"
          >
            <h3 className="text-gold-400 font-semibold text-center mb-3 text-base shrink-0">
              {slide.title}
            </h3>
            <div className="flex-1 flex flex-col justify-center overflow-y-auto">
              {slide.content(cardSize)}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setPage([i, i > page ? 1 : -1])}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-200',
              i === page
                ? 'bg-gold-400 scale-125'
                : 'bg-white/20 hover:bg-white/40'
            )}
            aria-label={`Go to slide ${i + 1}: ${SLIDES[i].title}`}
          />
        ))}
      </div>

      {/* Prev / Next buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => paginate(-1)}
          disabled={page === 0}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            page === 0
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
        >
          &#x2190; Prev
        </button>
        <button
          onClick={() => paginate(1)}
          disabled={page === SLIDES.length - 1}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            page === SLIDES.length - 1
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/70 hover:text-white hover:bg-white/10'
          )}
        >
          Next &#x2192;
        </button>
      </div>
    </div>
  );
}
