import { cardLabel, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import { CardFace } from './Card';
import { isRed, textSuits } from './cards';
import { who } from '../store/notes';

/** A compact pill at the top of the table: it never covers the trick spots. The ticker announces it, so no live region here. */
export function ReceivedCard({ view, received, onDismiss }: { view: PlayerView; received: { card: Card; from: PlayerId }; onDismiss(): void }) {
  return (
    <button type="button" className="received" aria-label={`Card received: ${textSuits(cardLabel(received.card))} from ${who(view, received.from)}. Dismiss`} onClick={onDismiss}>
      <span className="received__lbl">You got</span>
      <span className={`card received__card ${isRed(received.card) ? 'card--red' : ''}`} aria-hidden="true">
        <CardFace card={received.card} />
      </span>
      <span className="received__from">from <b>{who(view, received.from)}</b></span>
    </button>
  );
}
