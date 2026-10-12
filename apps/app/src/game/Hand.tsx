import type { CSSProperties } from 'react';
import { cardKey, type Card, type Suit } from '@tysiac/engine';
import { CardButton, type CardLook } from './Card';
import { glowFor, marriageTag, sortHand } from './cards';

export interface HandProps {
  cards: Card[];
  /** cardKey of the raised card. */
  selected: string | null;
  isPlayable(card: Card): boolean;
  /** cardKeys the coach recommends (thin accent outline): the card to play, or the hand-out cards. */
  recommended: readonly string[];
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
  // One pill per undeclared marriage, spanning its K and Q (adjacent in the sort); on the Q alone if they ever are not.
  const tags = sorted.flatMap((k, ik) => {
    const text = marriageTag(k, cards, declared);
    if (!text) return [];
    const iq = sorted.findIndex(c => c.suit === k.suit && c.rank === 'Q');
    const adjacent = iq === ik + 1;
    const raised = [k, sorted[iq]].some(c => cardKey(c) === selected);
    return [{ suit: k.suit, text, i: adjacent ? ik : iq, span: adjacent ? 2 : 1, raised }];
  });
  return (
    <div className="hand" role="group" aria-label="Your hand" style={{ '--n': sorted.length } as CSSProperties}>
      {sorted.map((card, i) => {
        const key = cardKey(card);
        const look: CardLook = key === selected ? 'raised' : !isPlayable(card) ? 'dim' : recommended.includes(key) ? 'recommended' : 'normal';
        return (
          <CardButton
            key={key}
            card={card}
            look={look}
            glow={glowFor(card, cards, declared, trump)}
            shake={shake === key}
            className={`hand__card ${key === fresh ? 'card--fresh' : ''}`}
            style={{ '--i': i } as CSSProperties}
            onTap={() => onTap(card)}
          />
        );
      })}
      {tags.map(t => (
        <span
          key={t.suit}
          className={`hand__mtag ${t.raised ? 'hand__mtag--up' : ''}`}
          data-marriage={t.suit}
          style={{ '--i': t.i, '--span': t.span } as CSSProperties}
          aria-hidden="true"
        >
          {t.text}
        </span>
      ))}
    </div>
  );
}
