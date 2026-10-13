import { RULES, type EngineMsg, type PlayerView, type RoundSummary } from '@tysiac/engine';
import { textSuits } from './cards';
import { engineText } from '../i18n/engineText';
import { Sheet } from '../ui/Sheet';
import { who } from '../store/notes';
import { BARREL, bidChip } from './format';
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

/** Signed with a real minus sign. */
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export interface RoundResultSheetProps {
  summary: RoundSummary;
  view: PlayerView;
  note: EngineMsg | null;
  onContinue(): void;
}

/**
 * OG RoundResultModal: a made/failed banner, then one card per player (name and the round's points big,
 * tricks and marriages, the running total), the bidder highlighted with a made or failed badge.
 */
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
                    {summary.outcome === 'made'
                      ? t('game.result.badgeMade', { bid: bidChip(summary.bid) })
                      : summary.outcome === 'failed'
                        ? t('game.result.badgeFailed', { bid: bidChip(summary.bid) })
                        : bidChip(summary.bid)}
                  </span>
                )}
              </span>
              <span className={`rrow__delta display ${p.scoreChange < 0 ? 'neg' : p.scoreChange > 0 ? 'pos' : ''}`}>{signed(p.scoreChange)}</span>
              <span className="rrow__detail">
                {p.sittingOut ? (
                  p.marriagePoints > 0 ? t('game.result.satOutTalon', { n: p.marriagePoints }) : t('game.result.satOut')
                ) : (
                  <>
                    {t('game.col.tricks')} {p.trickPoints}
                    {p.marriagePoints > 0 && <> · {t('game.col.marriages')} +{p.marriagePoints}</>}
                  </>
                )}
                {p.fellOffBarrel && <span className="rrow__fell"> · {t('game.result.fellOff')}</span>}
              </span>
              <span className="rrow__total">
                {t('game.col.total')} <b>{p.newTotalScore}</b>
                {barrel && ` ${BARREL}`}
              </span>
            </li>
          );
        })}
      </ul>
      {note && (
        <p className="coachnote">
          <b>{t('game.coach.label')}</b> {textSuits(engineText(note, view))}
        </p>
      )}
    </Sheet>
  );
}
