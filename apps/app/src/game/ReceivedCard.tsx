import type { Card, PlayerId, PlayerView } from '@tysiac/engine';
import { CardFace } from './Card';
import { isRed, textSuits } from './cards';
import { who } from '../store/notes';
import { cardText } from '../i18n/engineText';
import { useT } from '../i18n/useT';

/**
 * The card a player handed me, shown big at the foot of the table (OG: a "Card Received" dialog). It stays
 * until I dismiss it or play my first card; it sits over my own trick spot, which is empty until then, and
 * never over the action zone. The ticker announces it, so no live region here.
 */
export function ReceivedCard({ view, received, onDismiss }: { view: PlayerView; received: { card: Card; from: PlayerId }; onDismiss(): void }) {
  const t = useT();
  const from = who(view, received.from);
  // The sender's name is bold inside the translated "from {player}".
  const [before, after = ''] = t('game.received.from', { player: '\u0000' }).split('\u0000');
  return (
    <button
      type="button"
      className="received"
      aria-label={t('game.received.aria', { card: textSuits(cardText(received.card)), player: from })}
      onClick={onDismiss}
    >
      <span className={`card received__card ${isRed(received.card) ? 'card--red' : ''}`} aria-hidden="true">
        <CardFace card={received.card} />
      </span>
      <span className="received__text">
        <span className="received__lbl">{t('game.received.got')}</span>
        <span className="received__from">
          {before}
          <b>{from}</b>
          {after}
        </span>
      </span>
      <span className="received__x" aria-hidden="true">
        ✕
      </span>
    </button>
  );
}
