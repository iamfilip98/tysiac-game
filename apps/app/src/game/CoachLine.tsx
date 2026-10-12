import type { Advice } from '@tysiac/engine';

export function CoachLine({ advice, note, onWhy }: { advice: Advice | null; note: string | null; onWhy(): void }) {
  const text = advice?.headline ?? note;
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
