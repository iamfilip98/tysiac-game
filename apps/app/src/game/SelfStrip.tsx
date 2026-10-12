import type { PlayerView } from '@tysiac/engine';

/** The viewer's own identity line above the hand: avatar, name, dealer marker, coach badge and score. */
export function SelfStrip({ view, coach }: { view: PlayerView; coach: boolean }) {
  const me = view.seats.find(s => s.id === view.me);
  const dealer = view.round?.dealer === view.me;
  return (
    <div className="selfstrip" aria-label="You">
      <span className="selfstrip__avatar" aria-hidden="true">{me?.avatar}</span>
      <span className="selfstrip__name">{me?.name ?? 'You'}</span>
      {dealer && <span className="selfstrip__dealer" title="Dealer">Dealer</span>}
      {coach && <span role="img" aria-label="coach on">🎓</span>}
      <span className="selfstrip__score" aria-label="Your score">{view.scores[view.me]?.total ?? 0}</span>
    </div>
  );
}
