import type { PlayerView } from '@tysiac/engine';
import { BARREL, onBarrel, pts } from './format';
import { useT } from '../i18n/useT';

/** The viewer's own identity line above the hand: avatar, name, dealer marker, Coach chip and score. */
export function SelfStrip({ view, coach, myTurn }: { view: PlayerView; coach: boolean; myTurn: boolean }) {
  const t = useT();
  const me = view.seats.find(s => s.id === view.me);
  const total = view.scores[view.me]?.total ?? 0;
  const dealer = view.round?.dealer === view.me;
  return (
    <div className={`selfstrip ${myTurn ? 'selfstrip--turn' : ''}`} aria-label={t('common.you')}>
      <span className="selfstrip__avatar" aria-hidden="true">{me?.avatar}</span>
      <span className="selfstrip__name">{me?.name ?? t('common.you')}</span>
      {myTurn && <span className="selfstrip__turn">{t('game.self.turn')}</span>}
      {dealer && <span className="selfstrip__dealer" title={t('game.self.dealer')}>{t('game.self.dealer')}</span>}
      {coach && <span className="chip chip--coach">{t('game.coachChip')}</span>}
      <span className="selfstrip__score" aria-label={t('game.self.scoreAria')}>
        {pts(total)}
        {onBarrel(total) && ` ${BARREL}`}
      </span>
    </div>
  );
}
