import type { PlayerView } from '@tysiac/engine';
import type { ClientState } from '../store/client';
import { announceText } from './announce';
import { useT } from '../i18n/useT';

/**
 * What just happened, in a pill that never covers a card or an opponent and never takes taps. With two
 * opponents it sits in the empty middle of the opponents row, between them; with three, that middle is the
 * opponent across, so it is laid over the top bar's middle for a few seconds.
 * Either way it is laid over its grid cell without sizing it (table.css), so an announcement can never move
 * a row or the trick cards.
 */
export function Ticker({ view, announce }: { view: PlayerView; announce: ClientState['announce'] }) {
  useT();
  const where = view.seats.length === 4 ? 'top' : 'opps';
  return (
    <p className={`ticker ticker--${where}`} role="status" aria-live="polite">
      {announce && (
        <span key={announce.id} className="ticker__text">
          <span className="ticker__line">{announceText(announce.a, view)}</span>
        </span>
      )}
    </p>
  );
}
