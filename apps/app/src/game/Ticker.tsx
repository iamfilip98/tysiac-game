import type { PlayerView } from '@tysiac/engine';
import type { ClientState } from '../store/client';
import { announceText } from './announce';

/** One line under the opponents: what just happened. Sits in the table's grid cell and never takes taps. */
export function Ticker({ view, announce }: { view: PlayerView; announce: ClientState['announce'] }) {
  return (
    <p className="ticker" role="status" aria-live="polite">
      {announce && <span key={announce.id} className="ticker__text">{announceText(announce.a, view)}</span>}
    </p>
  );
}
