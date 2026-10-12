import { cardLabel, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import { CardFace } from './Card';
import { isRed, textSuits } from './cards';
import { who } from '../store/notes';

/**
 * The card a player handed me, shown big at the foot of the table (OG: a "Card Received" dialog). It stays
 * until I dismiss it or play my first card; it sits over my own trick spot, which is empty until then, and
 * never over the action zone. The ticker announces it, so no live region here.
 */
export function ReceivedCard({ view, received, onDismiss }: { view: PlayerView; received: { card: Card; from: PlayerId }; onDismiss(): void }) {
  const from = who(view, received.from);
  return (
    <button type="button" className="received" aria-label={`Card received: ${textSuits(cardLabel(received.card))} from ${from}. Dismiss`} onClick={onDismiss}>
      <span className={`card received__card ${isRed(received.card) ? 'card--red' : ''}`} aria-hidden="true">
        <CardFace card={received.card} />
      </span>
      <span className="received__text">
        <span className="received__lbl">You got</span>
        <span className="received__from">
          from <b>{from}</b>
        </span>
      </span>
      <span className="received__x" aria-hidden="true">
        ✕
      </span>
    </button>
  );
}
