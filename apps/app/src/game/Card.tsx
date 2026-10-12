import type { CSSProperties } from 'react';
import { m } from 'motion/react';
import { cardKey, cardLabel, type Card } from '@tysiac/engine';
import { isRed, type CardGlow } from './cards';
import './card.css';

export type CardLook = 'normal' | 'dim' | 'raised' | 'recommended';

/** Suit glyphs with U+FE0E: iOS otherwise may draw ♥/♦ as colour emoji. */
export const SUIT_TEXT: Record<Card['suit'], string> = {
  hearts: '♥\uFE0E',
  diamonds: '♦\uFE0E',
  clubs: '♣\uFE0E',
  spades: '♠\uFE0E',
};

export function CardFace({ card }: { card: Card }) {
  const s = SUIT_TEXT[card.suit];
  const idx = (br: boolean) => (
    <span className={`card__idx ${br ? 'card__idx--br' : ''}`} aria-hidden="true">
      <span className="card__rank">{card.rank}</span>
      <span className="card__suit">{s}</span>
    </span>
  );
  return (
    <>
      {idx(false)}
      <span className="card__pip" aria-hidden="true">
        {s}
      </span>
      {idx(true)}
    </>
  );
}

export interface CardButtonProps {
  card: Card;
  look: CardLook;
  tag?: string | null;
  shake?: boolean;
  glow?: CardGlow;
  className?: string;
  style?: CSSProperties;
  onTap(): void;
}

export function CardButton({ card, look, tag, shake, glow, className = '', style, onTap }: CardButtonProps) {
  return (
    <m.button
      type="button"
      layout
      layoutId={cardKey(card)}
      className={`card ${isRed(card) ? 'card--red' : ''} card--${look} ${glow ? `card--glow-${glow}` : ''} ${className}`}
      aria-label={cardLabel(card)}
      aria-pressed={look === 'raised'}
      aria-disabled={look === 'dim' ? true : undefined}
      data-card={cardKey(card)}
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
  return (
    <span className={`card card--mini ${isRed(card) ? 'card--red' : ''}`} role="img" aria-label={cardLabel(card)}>
      <CardFace card={card} />
    </span>
  );
}

export function CardBack({ size = 'table' }: { size?: 'table' | 'mini' }) {
  return <span className={`back ${size === 'mini' ? 'back--mini' : ''}`} aria-hidden="true" />;
}
