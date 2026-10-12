import { cardLabel, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import { CardFace } from './Card';
import { isRed } from './cards';
import { who } from '../store/notes';

export function ReceivedCard({ view, received, onDismiss }: { view: PlayerView; received: { card: Card; from: PlayerId }; onDismiss(): void }) {
  return (
    <div className="received" role="status" aria-label="Card received" onClick={onDismiss}>
      <span className="received__lbl">You got</span>
      <span className={`card received__card ${isRed(received.card) ? 'card--red' : ''}`} role="img" aria-label={cardLabel(received.card)}>
        <CardFace card={received.card} />
      </span>
      <span className="received__from">from <b>{who(view, received.from)}</b></span>
    </div>
  );
}
