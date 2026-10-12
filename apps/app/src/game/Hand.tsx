import type { CSSProperties } from 'react';
import { cardKey, type Card, type Suit } from '@tysiac/engine';
import { CardButton, type CardLook } from './Card';
import { glowFor, marriageTag, sortHand } from './cards';
import { useT } from '../i18n/useT';

export interface HandProps {
  cards: Card[];
  /** cardKey of the raised card. */
  selected: string | null;
  isPlayable(card: Card): boolean;
  /** cardKeys the coach recommends (gold arrow above; never raised or selected): the card to play, or the hand-out cards. */
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
  const t = useT();
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
  const underPill = (i: number) => tags.some(t => i >= t.i && i < t.i + t.span);
  const arrows = sorted.flatMap((c, i) => (recommended.includes(cardKey(c)) ? [{ key: cardKey(c), i, raised: cardKey(c) === selected }] : []));
  return (
    <div className="hand" role="group" aria-label={t('game.hand')} style={{ '--n': sorted.length } as CSSProperties}>
      {sorted.map((card, i) => {
        const key = cardKey(card);
        const look: CardLook = key === selected ? 'raised' : !isPlayable(card) ? 'dim' : 'normal';
        return (
          <CardButton
            key={key}
            card={card}
            look={look}
            glow={glowFor(card, cards, declared, trump)}
            coach={recommended.includes(key)}
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
      {arrows.map(a => (
        <span
          key={a.key}
          className={`hand__coach ${a.raised ? 'hand__coach--up' : ''} ${underPill(a.i) ? 'hand__coach--pill' : ''}`}
          data-coach-arrow={a.key}
          style={{ '--i': a.i, '--last': a.i === sorted.length - 1 ? 1 : 0 } as CSSProperties}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 20" width="24" height="20">
            <path d="M3 3h18L12 17z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
