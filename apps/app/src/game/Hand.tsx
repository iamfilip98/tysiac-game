import type { CSSProperties } from 'react';
import { cardKey, type Card, type Suit } from '@tysiac/engine';
import { CardButton, type CardLook } from './Card';
import { glowFor, marriageTag, sortHand } from './cards';

export interface HandProps {
  cards: Card[];
  /** cardKey of the raised card. */
  selected: string | null;
  isPlayable(card: Card): boolean;
  /** cardKey the coach recommends (thin accent outline). */
  recommended: string | null;
  /** Marriages already declared by the viewer (no tag for those). */
  declared: readonly Suit[];
  /** The round's trump suit (blue glow on those cards). */
  trump: Suit | null;
  /** cardKey of a card just received (pulsing outline). */
  fresh: string | null;
  shake: string | null;
  onTap(card: Card): void;
}

/** The viewer's cards. Tapping only reports the tap — it never plays a card. */
export function Hand({ cards, selected, isPlayable, recommended, declared, trump, fresh, shake, onTap }: HandProps) {
  const sorted = sortHand(cards);
  return (
    <div className="hand" role="group" aria-label="Your hand" style={{ '--n': sorted.length } as CSSProperties}>
      {sorted.map((card, i) => {
        const key = cardKey(card);
        const look: CardLook = key === selected ? 'raised' : !isPlayable(card) ? 'dim' : key === recommended ? 'recommended' : 'normal';
        return (
          <CardButton
            key={key}
            card={card}
            look={look}
            tag={marriageTag(card, cards, declared)}
            glow={glowFor(card, cards, declared, trump)}
            shake={shake === key}
            className={`hand__card ${key === fresh ? 'card--fresh' : ''}`}
            style={{ '--i': i } as CSSProperties}
            onTap={() => onTap(card)}
          />
        );
      })}
    </div>
  );
}
