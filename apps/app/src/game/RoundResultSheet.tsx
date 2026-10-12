import { RULES, type PlayerView, type RoundSummary } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { who } from '../store/notes';
import { BARREL, bidChip } from './format';

export function roundHeadline(summary: RoundSummary, view: PlayerView): string {
  const name = who(view, summary.bidder);
  if (summary.outcome === 'thrown') return `${name} threw in at ${summary.bid}`;
  if (summary.wykladana) return `${name} won every trick — wykładana!`;
  return summary.outcome === 'made' ? `${name} made ${summary.bid}` : `${name} failed ${summary.bid}`;
}

/** Signed with a real minus sign. */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export interface RoundResultSheetProps {
  summary: RoundSummary;
  view: PlayerView;
  note: string | null;
  onContinue(): void;
}

/**
 * OG RoundResultModal: a made/failed banner, then one card per player (name and the round's points big,
 * tricks and marriages, the running total), the bidder highlighted with a made or failed badge.
 */
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
      <p className={`result__headline result__headline--${summary.outcome} display`}>{roundHeadline(summary, view)}</p>
      <ul className="rrows">
        {summary.players.map(p => {
          const seat = view.seats.find(s => s.id === p.playerId);
          const bidder = p.playerId === summary.bidder;
          const barrel = p.newTotalScore >= RULES.barrelAt && p.newTotalScore < RULES.winAt;
          return (
            <li
              key={p.playerId}
              className={`rrow ${bidder ? 'rrow--bidder' : ''} ${p.playerId === view.me ? 'rrow--me' : ''} ${p.sittingOut ? 'rrow--out' : ''}`}
            >
              <span className="avatar rrow__avatar" aria-hidden="true">
                {seat?.avatar}
              </span>
              <span className="rrow__who">
                <span className="rrow__name">{who(view, p.playerId)}</span>
                {bidder && (
                  <span className={`chip rrow__bid rrow__bid--${summary.outcome}`}>
                    {bidChip(summary.bid)}
                    {summary.outcome === 'made' ? ' ✓ made' : summary.outcome === 'failed' ? ' ✗ failed' : ''}
                  </span>
                )}
              </span>
              <span className={`rrow__delta display ${p.scoreChange < 0 ? 'neg' : p.scoreChange > 0 ? 'pos' : ''}`}>{signed(p.scoreChange)}</span>
              <span className="rrow__detail">
                {p.sittingOut ? (
                  'sits out'
                ) : (
                  <>
                    Tricks {p.trickPoints}
                    {p.marriagePoints > 0 && <> · Marriages +{p.marriagePoints}</>}
                  </>
                )}
                {p.fellOffBarrel && <span className="rrow__fell"> · fell off the barrel</span>}
              </span>
              <span className="rrow__total">
                Total <b>{p.newTotalScore}</b>
                {barrel && ` ${BARREL}`}
              </span>
            </li>
          );
        })}
      </ul>
      {note && (
        <p className="coachnote">
          <b>Coach:</b> {note}
        </p>
      )}
    </Sheet>
  );
}
