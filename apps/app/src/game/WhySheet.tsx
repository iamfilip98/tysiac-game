import type { Advice } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';

export function WhySheet({ advice, onClose }: { advice: Advice; onClose(): void }) {
  return (
    <Sheet title="Why?" onClose={onClose}>
      <p className="result__headline display">{advice.headline}</p>
      <ul className="why">
        {advice.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </Sheet>
  );
}
