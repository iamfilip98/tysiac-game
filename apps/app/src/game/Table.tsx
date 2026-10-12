import { AnimatePresence, m } from 'motion/react';
import type { CSSProperties } from 'react';
import { cardEquals, cardKey, cardLabel, type Card, type PlayerId, type PlayerView, type TrickCard } from '@tysiac/engine';
import { CardBack, CardFace } from './Card';
import { isRed } from './cards';
import { spotsFor, type Spot } from './seating';
import type { HeldTrick, MarriageFx } from '../store/client';
import './table.css';
import './fx.css';

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
  /** A marriage declared in this trick: gold ring, the led Q drawn gold. */
  marriage: MarriageFx | null;
  /** The completed trick on hold: its winning card is marked (blue when a trump took it). */
  held: HeldTrick | null;
}

const SPARKS = [0, 1, 2, 3, 4, 5, 6, 7];

/** OG TrickPile: rotating conic gold ring, pulsing inner glow and 8 sparks (static gold ring with reduced motion). */
function MarriageRing() {
  return (
    <div className="fx fx--marriage" aria-hidden="true">
      <span className="fx__ring" />
      <span className="fx__glow" />
      {SPARKS.map(i => (
        <span key={i} className="fx__spark" style={{ '--a': `${i * 45}deg`, '--d': `${i * 0.25}s` } as CSSProperties} />
      ))}
    </div>
  );
}

/** OG trump win: blue glow pulse and 8 blue sparks, kept (pulsing) for the whole hold. */
function TrumpBurst() {
  return (
    <div className="fx fx--trumpwin" aria-hidden="true">
      <span className="fx__glow" />
      {SPARKS.map(i => (
        <span key={i} className="fx__spark" style={{ '--a': `${i * 45}deg`, '--d': `${i * 0.05}s` } as CSSProperties} />
      ))}
    </div>
  );
}

export function Table({ view, pending, sweepTo, marriage, held }: TableProps) {
  const r = view.round;
  const spots = spotsFor(view.seats.map(s => s.id), view.me);
  const trick: TrickCard[] = r ? [...r.trick.cards, ...(pending && !r.trick.cards.some(t => cardKey(t.card) === cardKey(pending)) ? [{ p: view.me, card: pending }] : [])] : [];
  const showTalon = !!r && (view.phase === 'bidding' || view.phase === 'talon' || view.phase === 'decision');
  return (
    <section className="table" aria-label="Table">
      {marriage && <MarriageRing key={marriage.id} />}
      {held?.byTrump && <TrumpBurst />}
      {showTalon && <Talon cards={view.phase === 'bidding' ? null : (r?.talon ?? null)} />}
      <AnimatePresence custom={(sweepTo && spots[sweepTo]) || 'top'}>
        {trick.map(t => {
          const spot = spots[t.p] ?? 'top';
          const mine = t.p === view.me;
          const gold = !!marriage && t.p === marriage.p && t.card.suit === marriage.suit && (t.card.rank === 'Q' || t.card.rank === 'K');
          const win = !!held && cardEquals(held.card, t.card);
          const look = [
            gold ? 'card--gold' : r?.trump && t.card.suit === r.trump ? 'card--glow-trump' : '',
            win ? (held!.byTrump ? 'tcard--win tcard--win-trump' : 'tcard--win') : held ? 'tcard--lost' : '',
          ].join(' ');
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
              className={`card tcard tcard--${spot} ${isRed(t.card) ? 'card--red' : ''} ${look}`}
              role="img"
              aria-label={cardLabel(t.card)}
              data-win={win || undefined}
            >
              <CardFace card={t.card} />
            </m.div>
          );
        })}
      </AnimatePresence>
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
