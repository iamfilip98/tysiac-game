import type { EngineMsg, PlayerView } from '@tysiac/engine';
import { textSuits } from './cards';
import { useT } from '../i18n/useT';
import { lineText, type CoachAdvice } from '../i18n/engineText';

export function CoachLine({ view, advice, note, onWhy }: { view: PlayerView; advice: CoachAdvice | null; note: EngineMsg | null; onWhy(): void }) {
  const t = useT();
  const raw = advice?.headline ?? note;
  const text = raw ? textSuits(lineText(raw, view)) : null;
  return (
    <div className="coachline" aria-live="polite">
      {text && (
        <>
          <span className="coachline__text">
            <b>{t('game.coach.label')}</b> {text}
          </span>
          {advice && advice.reasons.length > 0 && (
            <button type="button" className="linkbtn" onClick={onWhy}>
              {t('game.coach.why')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
