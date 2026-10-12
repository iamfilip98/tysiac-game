import type { Advice } from '@tysiac/engine';
import { textSuits } from './cards';

export function CoachLine({ advice, note, onWhy }: { advice: Advice | null; note: string | null; onWhy(): void }) {
  const raw = advice?.headline ?? note;
  const text = raw ? textSuits(raw) : raw;
  return (
    <div className="coachline" aria-live="polite">
      {text && (
        <>
          <span className="coachline__text">
            <b>Coach:</b> {text}
          </span>
          {advice && advice.reasons.length > 0 && (
            <button type="button" className="linkbtn" onClick={onWhy}>
              Why?
            </button>
          )}
        </>
      )}
    </div>
  );
}
