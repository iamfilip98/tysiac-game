import type { PlayerView } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { textSuits } from './cards';
import { useT } from '../i18n/useT';
import { lineText, type CoachAdvice } from '../i18n/engineText';

export function WhySheet({ view, advice, onClose }: { view: PlayerView; advice: CoachAdvice; onClose(): void }) {
  const t = useT();
  return (
    <Sheet title={t('game.coach.why')} onClose={onClose}>
      <p className="result__headline display">{textSuits(lineText(advice.headline, view))}</p>
      <ul className="why">
        {advice.reasons.map((r, i) => (
          <li key={i}>{textSuits(lineText(r, view))}</li>
        ))}
      </ul>
    </Sheet>
  );
}
