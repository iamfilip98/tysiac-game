import { RULES, type EngineMsg, type PlayerView, type RoundSummary } from '@tysiac/engine';
import { textSuits } from './cards';
import { engineText } from '../i18n/engineText';
import { Sheet } from '../ui/Sheet';
import { who } from '../store/notes';

export function roundHeadline(summary: RoundSummary, view: PlayerView): string {
  const name = who(view, summary.bidder);
  if (summary.outcome === 'thrown') return `${name} threw in at ${summary.bid}`;
  if (summary.wykladana) return `${name} won every trick — wykładana!`;
  return summary.outcome === 'made' ? `${name} made ${summary.bid}` : `${name} failed ${summary.bid}`;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export interface RoundResultSheetProps {
  summary: RoundSummary;
  view: PlayerView;
  note: EngineMsg | null;
  onContinue(): void;
}

export function RoundResultSheet({ summary, view, note, onContinue }: RoundResultSheetProps) {
  return (
    <Sheet
      title={`Round ${summary.number}`}
      footer={
        <button type="button" className="btn btn--pri" onClick={onContinue}>
          Continue
        </button>
      }
    >
      <p className="result__headline display">{roundHeadline(summary, view)}</p>
      <table className="result">
        <thead>
          <tr>
            <th>Player</th>
            <th>Tricks</th>
            <th>Marriages</th>
            <th>Round</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {summary.players.map(p => (
            <tr key={p.playerId}>
              <td>{who(view, p.playerId)}</td>
              <td>{p.sittingOut ? '—' : p.trickPoints}</td>
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
          <b>Coach:</b> {textSuits(engineText(note, view))}
        </p>
      )}
    </Sheet>
  );
}
