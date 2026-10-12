import type { PlayerView } from '@tysiac/engine';
import { BARREL, onBarrel, pts } from './format';

/** The viewer's own identity line above the hand: avatar, name, dealer marker, Coach chip and score. */
export function SelfStrip({ view, coach, myTurn }: { view: PlayerView; coach: boolean; myTurn: boolean }) {
  const me = view.seats.find(s => s.id === view.me);
  const total = view.scores[view.me]?.total ?? 0;
  const dealer = view.round?.dealer === view.me;
  return (
    <div className={`selfstrip ${myTurn ? 'selfstrip--turn' : ''}`} aria-label="You">
      <span className="selfstrip__avatar" aria-hidden="true">{me?.avatar}</span>
      <span className="selfstrip__name">{me?.name ?? 'You'}</span>
      {myTurn && <span className="selfstrip__turn">Your turn</span>}
      {dealer && <span className="selfstrip__dealer" title="Dealer">Dealer</span>}
      {coach && <span className="chip chip--coach">Coach</span>}
      <span className="selfstrip__score" aria-label="Your score">
        {pts(total)}
        {onBarrel(total) && ` ${BARREL}`}
      </span>
    </div>
  );
}
