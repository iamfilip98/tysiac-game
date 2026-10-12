import type { PlayerView } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { gameStats } from './stats';
import { useT } from '../i18n/useT';

export interface GameOverSheetProps {
  view: PlayerView;
  isHost: boolean;
  onRematch(): void;
  onHome(): void;
}

export function GameOverSheet({ view, isHost, onRematch, onHome }: GameOverSheetProps) {
  const t = useT();
  const stats = gameStats(view);
  const winner = view.seats.find(s => s.id === view.winner);
  const headline = view.winner === view.me ? t('game.over.you') : t('game.over.win', { player: winner?.name ?? t('common.someone') });
  return (
    <Sheet
      title={t('game.over.title')}
      footer={
        <>
          <button type="button" className="btn btn--sec" onClick={onHome}>
            {t('game.over.home')}
          </button>
          {isHost && (
            <button type="button" className="btn btn--pri" onClick={onRematch}>
              {t('game.over.rematch')}
            </button>
          )}
        </>
      }
    >
      <p className="result__headline display">🏆 {headline}</p>
      <table className="stats">
        <thead>
          <tr>
            <th>{t('game.col.player')}</th>
            <th>{t('game.col.score')}</th>
            <th>{t('game.col.made')}</th>
            <th>{t('game.col.failed')}</th>
            <th>{t('game.col.marr')}</th>
            <th>{t('game.col.best')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.id}>
              <td>
                {s.avatar} {s.name}
              </td>
              <td>{s.total}</td>
              <td>{s.bidsMade}</td>
              <td>{s.bidsFailed}</td>
              <td>{s.marriagePoints}</td>
              <td>{s.bestRound}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isHost && <p className="coachnote">{t('game.over.waitHost')}</p>}
    </Sheet>
  );
}
