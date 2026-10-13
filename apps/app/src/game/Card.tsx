import type { CSSProperties } from 'react';
import { m } from 'motion/react';
import { cardKey, type Card } from '@tysiac/engine';
import { SUIT_TEXT, hasTail, isRed, type CardGlow } from './cards';
import { cardText } from '../i18n/engineText';
import { t } from '../i18n';
import { useT } from '../i18n/useT';
import './card.css';

export type CardLook = 'normal' | 'dim' | 'raised';

export { SUIT_TEXT };

/** Rank letters follow the language (Polish D/W, Danish E/D/B); suit glyphs never change. */
export function CardFace({ card }: { card: Card }) {
  useT();
  const s = SUIT_TEXT[card.suit];
  const rank = t(`card.rank.${card.rank}`);
  // A letter with a tail below the baseline (Q) needs more room above the suit under it.
  const tail = hasTail(rank) || undefined;
  const idx = (br: boolean) => (
    <span className={`card__idx ${br ? 'card__idx--br' : ''}`} data-tail={tail} aria-hidden="true">
      <span className="card__rank">{rank}</span>
      <span className="card__suit">{s}</span>
    </span>
  );
  return (
    <span className="card__face">
      {idx(false)}
      <span className="card__pip" aria-hidden="true">
        {s}
      </span>
      {idx(true)}
    </span>
  );
}

export interface CardButtonProps {
  card: Card;
  look: CardLook;
  tag?: string | null;
  shake?: boolean;
  glow?: CardGlow;
  /** The coach recommends this card (an arrow is drawn above it by the hand; the card itself never moves). */
  coach?: boolean;
  className?: string;
  style?: CSSProperties;
  onTap(): void;
}

export function CardButton({ card, look, tag, shake, glow, coach, className = '', style, onTap }: CardButtonProps) {
  useT();
  return (
    <m.button
      type="button"
      layout
      layoutId={cardKey(card)}
      className={`card ${isRed(card) ? 'card--red' : ''} card--${look} ${glow ? `card--glow-${glow}` : ''} ${className}`}
      aria-label={cardText(card)}
      aria-pressed={look === 'raised'}
      aria-disabled={look === 'dim' ? true : undefined}
      data-card={cardKey(card)}
      data-coach={coach || undefined}
      style={style}
      onClick={onTap}
      animate={shake ? { x: [0, -9, 9, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: shake ? 0.45 : 0.2 }}
    >
      <CardFace card={card} />
      {tag && <span className="card__tag">{tag}</span>}
    </m.button>
  );
}

export function MiniCard({ card }: { card: Card }) {
  useT();
  return (
    <span className={`card card--mini ${isRed(card) ? 'card--red' : ''}`} role="img" aria-label={cardText(card)}>
      <CardFace card={card} />
    </span>
  );
}

export function CardBack({ size = 'table' }: { size?: 'table' | 'mini' }) {
  return <span className={`back ${size === 'mini' ? 'back--mini' : ''}`} aria-hidden="true" />;
}
