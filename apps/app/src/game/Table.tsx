import { AnimatePresence, m } from 'motion/react';
import { cardKey, cardLabel, type Card, type CompletedTrick, type PlayerId, type PlayerView, type TrickCard } from '@tysiac/engine';
import { CardBack, CardFace, MiniCard } from './Card';
import { isRed } from './cards';
import { spotsFor, type Spot } from './seating';
import './table.css';

const FROM: Record<Spot, { x: string; y: string }> = {
  me: { x: '0%', y: '260%' },
  left: { x: '-320%', y: '-90%' },
  top: { x: '0%', y: '-260%' },
  right: { x: '320%', y: '-90%' },
};

const variants = {
  enter: (from: Spot) => ({ opacity: 0, scale: 0.7, x: FROM[from].x, y: FROM[from].y }),
  rest: { opacity: 1, scale: 1, x: '0%', y: '0%' },
  gone: (to: Spot) => ({ opacity: 0, scale: 0.5, x: FROM[to].x, y: FROM[to].y }),
};

export interface TableProps {
  view: PlayerView;
  /** The viewer's optimistically played card. */
  pending: Card | null;
  /** Winner of the trick being swept away. */
  sweepTo: PlayerId | null;
}

export function Table({ view, pending, sweepTo }: TableProps) {
  const r = view.round;
  const spots = spotsFor(view.seats.map(s => s.id), view.me);
  const trick: TrickCard[] = r ? [...r.trick.cards, ...(pending && !r.trick.cards.some(t => cardKey(t.card) === cardKey(pending)) ? [{ p: view.me, card: pending }] : [])] : [];
  const showTalon = !!r && (view.phase === 'bidding' || view.phase === 'decision');
  return (
    <section className="table" aria-label="Table">
      {showTalon && <Talon cards={view.phase === 'decision' ? (r?.talon ?? null) : null} />}
      <AnimatePresence custom={(sweepTo && spots[sweepTo]) || 'top'}>
        {trick.map(t => {
          const spot = spots[t.p] ?? 'top';
          const mine = t.p === view.me;
          return (
            <m.div
              key={cardKey(t.card)}
              layoutId={mine ? cardKey(t.card) : undefined}
              custom={spot}
              variants={variants}
              initial={mine ? false : 'enter'}
              animate="rest"
              exit="gone"
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className={`card tcard tcard--${spot} ${isRed(t.card) ? 'card--red' : ''}`}
              role="img"
              aria-label={cardLabel(t.card)}
            >
              <CardFace card={t.card} />
            </m.div>
          );
        })}
      </AnimatePresence>
      {r?.lastTrick && view.phase === 'tricks' && <LastTrick trick={r.lastTrick} />}
    </section>
  );
}

function Talon({ cards }: { cards: Card[] | null }) {
  return (
    <div className="talon" aria-label="Talon">
      {cards
        ? cards.map(c => (
            <span key={cardKey(c)} className={`card ${isRed(c) ? 'card--red' : ''}`} role="img" aria-label={cardLabel(c)}>
              <CardFace card={c} />
            </span>
          ))
        : [0, 1, 2].map(i => <CardBack key={i} />)}
      <span className="talon__lbl">talon</span>
    </div>
  );
}

function LastTrick({ trick }: { trick: CompletedTrick }) {
  return (
    <div className="lasttrick" aria-label="Last trick">
      <span className="lbl">Last</span>
      {trick.cards.map(t => (
        <MiniCard key={cardKey(t.card)} card={t.card} />
      ))}
    </div>
  );
}
