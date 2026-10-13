import type { PlayerView } from '@tysiac/engine';
import { BARREL, onBarrel, pts } from './format';
import { useT } from '../i18n/useT';

/**
 * The viewer's own identity above the hand: the avatar, then two rows beside it, name and score on top and the
 * Your turn / Dealer / Coach chips under them, so the chips get the strip's full width and never squeeze the name.
 */
export function SelfStrip({ view, coach, myTurn }: { view: PlayerView; coach: boolean; myTurn: boolean }) {
  const t = useT();
  const me = view.seats.find(s => s.id === view.me);
  const total = view.scores[view.me]?.total ?? 0;
  const dealer = view.round?.dealer === view.me;
  return (
    <div className={`selfstrip ${myTurn ? 'selfstrip--turn' : ''}`} aria-label={t('common.you')}>
      <span className="avatar selfstrip__avatar" aria-hidden="true">{me?.avatar}</span>
      <span className="selfstrip__name">{me?.name ?? t('common.you')}</span>
      <span className="selfstrip__score" aria-label={t('game.self.scoreAria')}>
        {pts(total)}
        {onBarrel(total) && ` ${BARREL}`}
      </span>
      <span className="selfstrip__chips">
        {myTurn && <span className="selfstrip__chip selfstrip__turn">{t('game.self.turn')}</span>}
        {dealer && <span className="selfstrip__chip selfstrip__dealer">{t('game.self.dealer')}</span>}
        {coach && <span className="selfstrip__chip chip--coach">{t('game.coachChip')}</span>}
      </span>
    </div>
  );
}
