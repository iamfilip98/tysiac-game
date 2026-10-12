import { RULES, type EngineMsg, type PlayerView, type RoundSummary } from '@tysiac/engine';
import { textSuits } from './cards';
import { engineText } from '../i18n/engineText';
import { Sheet } from '../ui/Sheet';
import { who } from '../store/notes';
import { t } from '../i18n';
import { useT } from '../i18n/useT';

export function roundHeadline(summary: RoundSummary, view: PlayerView): string {
  const p = { player: who(view, summary.bidder), bid: summary.bid };
  const you = summary.bidder === view.me;
  if (summary.outcome === 'thrown') return t(you ? 'game.result.threw.you' : 'game.result.threw', p);
  if (summary.wykladana) return t(you ? 'game.result.wykladana.you' : 'game.result.wykladana', p);
  if (summary.outcome === 'made') return t(you ? 'game.result.made.you' : 'game.result.made', p);
  return t(you ? 'game.result.failed.you' : 'game.result.failed', p);
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export interface RoundResultSheetProps {
  summary: RoundSummary;
  view: PlayerView;
  note: EngineMsg | null;
  onContinue(): void;
}

export function RoundResultSheet({ summary, view, note, onContinue }: RoundResultSheetProps) {
  useT();
  return (
    <Sheet
      title={t('game.result.title', { n: summary.number })}
      footer={
        <button type="button" className="btn btn--pri" onClick={onContinue}>
          {t('game.result.continue')}
        </button>
      }
    >
      <p className="result__headline display">{roundHeadline(summary, view)}</p>
      <table className="result">
        <thead>
          <tr>
            <th>{t('game.col.player')}</th>
            <th>{t('game.col.tricks')}</th>
            <th>{t('game.col.marriages')}</th>
            <th>{t('game.col.round')}</th>
            <th>{t('game.col.total')}</th>
          </tr>
        </thead>
        <tbody>
          {summary.players.map(p => (
            <tr key={p.playerId}>
              <td>{who(view, p.playerId)}</td>
              <td>{p.sittingOut ? '·' : p.trickPoints}</td>
              <td>{p.marriagePoints || ''}</td>
              <td className={p.scoreChange < 0 ? 'neg' : ''}>{signed(p.scoreChange)}</td>
              <td>
                {p.newTotalScore}
                {p.newTotalScore >= RULES.barrelAt && p.newTotalScore < RULES.winAt ? ' 🛢' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && (
        <p className="coachnote">
          <b>{t('game.coach.label')}</b> {textSuits(engineText(note, view))}
        </p>
      )}
    </Sheet>
  );
}
