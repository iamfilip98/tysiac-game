import { type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo, RoomSeat } from '../net/protocol';
import { CardBack, MiniCard } from './Card';
import { opponentIds } from './seating';
import { BARREL, PASS_CHIP, bidChip, onBarrel, pts } from './format';

export function chipFor(view: PlayerView, id: PlayerId): { text: string; muted: boolean } | null {
  const r = view.round;
  if (!r || r.sittingOut === id) return null;
  if (view.phase === 'bidding') {
    if (r.bid.passed.includes(id)) return { text: PASS_CHIP, muted: true };
    return r.bid.high === id ? { text: bidChip(r.bid.amount), muted: false } : null;
  }
  return r.bid.high === id ? { text: bidChip(r.bid.amount), muted: false } : null;
}

export interface OpponentsProps {
  view: PlayerView;
  room: RoomInfo | null;
  given?: Partial<Record<PlayerId, Card>>;
  /** Hand-out: seats without a card can be tapped to pick who gets the next card. */
  targetable?: boolean;
  /** Hand-out: the seat the next tapped card goes to (highlighted). */
  next?: PlayerId | null;
  onTarget?(p: PlayerId): void;
}

export function Opponents({ view, room, given = {}, targetable = false, next = null, onTarget }: OpponentsProps) {
  const ids = opponentIds(view.seats.map(s => s.id), view.me);
  return (
    <div className="opps" data-count={ids.length}>
      {ids.map(id => (
        <Opponent
          key={id}
          id={id}
          view={view}
          seat={room?.seats.find((s): s is RoomSeat => s?.id === id) ?? null}
          given={given[id] ?? null}
          targetable={targetable}
          next={next === id}
          onTarget={onTarget}
        />
      ))}
    </div>
  );
}

interface OpponentProps {
  id: PlayerId;
  view: PlayerView;
  seat: RoomSeat | null;
  given: Card | null;
  targetable: boolean;
  next: boolean;
  onTarget?(p: PlayerId): void;
}

function Opponent({ id, view, seat, given, targetable, next, onTarget }: OpponentProps) {
  const s = view.seats.find(x => x.id === id)!;
  const r = view.round;
  const sittingOut = r?.sittingOut === id;
  const count = r?.handCounts[id] ?? 0;
  const chip = chipFor(view, id);
  const total = view.scores[id]?.total ?? 0;
  const away = seat !== null && !seat.isBot && !seat.connected;
  const inTalon = view.phase === 'talon' && r !== null && id !== r.bid.high;
  const looking = inTalon && r.talonWaiting.includes(id);
  const seen = inTalon && !looking;
  const cls = `opp ${view.turn === id && !view.paused ? 'opp--turn' : ''} ${targetable && next && !given && !sittingOut ? 'opp--target' : ''}`;
  const body = (
    <>
      <span className="avatar">
        {s.avatar}
        {r?.dealer === id && <span className="avatar__dealer" title="Dealer">D</span>}
      </span>
      <span className="opp__name">
        {s.name}
      </span>
      {seat?.coach && <span className="chip chip--coach">Coach</span>}
      <span className="opp__meta">
        <span className="opp__score" aria-label={`Score ${pts(total)}`}>
          {pts(total)}
          {onBarrel(total) && (
            <span className="opp__barrel" role="img" aria-label="on the barrel">
              {' '}
              {BARREL}
            </span>
          )}
        </span>
        {chip && <span className={`chip ${chip.muted ? 'chip--muted' : ''}`}>{chip.text}</span>}
      </span>
      {sittingOut ? (
        <span className="opp__out">sits out</span>
      ) : (
        <span className="backs" role="img" aria-label={`${count} cards`}>
          {Array.from({ length: count }, (_, i) => (
            <CardBack key={i} size="mini" />
          ))}
        </span>
      )}
      {seen && <span className="badge badge--ok">✓ seen</span>}
      {looking && <span className="badge badge--looking">looking…</span>}
      {away && <span className="badge">{seat.botFor ? '🤖 bot playing' : 'away'}</span>}
    </>
  );
  // The given card, shown as a real (small) card under the seat until the hand-out is confirmed.
  const givenEl = given && (
    <span className="opp__given">
      <MiniCard card={given} />
    </span>
  );
  if (targetable && !sittingOut) {
    // A touch shortcut for the hand-out slots in the action zone (which carry the accessible labels).
    return (
      <button type="button" className={cls} data-seat={id} aria-hidden="true" tabIndex={-1} onClick={() => onTarget?.(id)}>
        {body}
        {givenEl}
      </button>
    );
  }
  return (
    <div className={cls} data-seat={id}>
      {body}
      {givenEl}
    </div>
  );
}
