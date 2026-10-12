import type { Action, PlayerId, PlayerView } from '@tysiac/engine';
import type { RoomInfo } from '../net/protocol';
import { who } from '../store/notes';
import { WaitLine } from './panels';

export interface TalonPanelProps {
  view: PlayerView;
  room: RoomInfo | null;
  now: number;
  busy: boolean;
  onAct(a: Action): void;
  onBotFor(p: PlayerId): void;
}

const names = (view: PlayerView, ids: PlayerId[]) =>
  ids.length <= 1 ? ids.map(p => who(view, p)).join('') : `${ids.slice(0, -1).map(p => who(view, p)).join(', ')} and ${who(view, ids[ids.length - 1])}`;

/** Public talon: watchers confirm with Seen; the bidder (and anyone done) sees who is still looking. */
export function TalonPanel({ view, room, now, busy, onAct, onBotFor }: TalonPanelProps) {
  const r = view.round!;
  const bidder = r.bid.high;
  const mustAck = view.legal.some(a => a.type === 'ackTalon');
  const waiting = r.talonWaiting.filter(p => p !== view.me);
  return (
    <>
      <div className="lbl">
        Talon · {who(view, bidder)} won at {r.bid.amount}
      </div>
      {mustAck ? (
        <>
          <p className="zone__text">These 3 cards go to {bidder === view.me ? 'you' : who(view, bidder)}. Tap Seen when you have looked.</p>
          <div className="zone__buttons">
            <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct({ type: 'ackTalon' })}>
              Seen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="zone__text">Waiting for {names(view, waiting)} to see the talon…</p>
          {waiting
            .filter(p => {
              const seat = room?.seats.find(x => x?.id === p);
              return !!seat && !seat.isBot && !seat.connected && !seat.botFor;
            })
            .map(p => (
              <WaitLine key={p} who={p} view={view} room={room} now={now} busy={busy} onBotFor={onBotFor} />
            ))}
        </>
      )}
    </>
  );
}
