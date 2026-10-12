import type { ReactNode } from 'react';
import { RULES, cardLabel, explainIllegal, marriagesInHand, type Action, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo, RoomSeat } from '../net/protocol';
import { AWAY_BOT_AFTER_MS } from '../net/connection';
import { who } from '../store/notes';
import type { HeldTrick } from '../store/client';
import { announceText } from './announce';
import { SUIT_TEXT, isRed, textSuits } from './cards';
import { CardFace } from './Card';

const VERB: Partial<Record<PlayerView['phase'], string>> = {
  bidding: 'is bidding',
  decision: 'is deciding: play or throw in',
  handout: 'is handing out cards',
  tricks: 'is playing',
};

/** A human seat that is disconnected with no bot covering for it. */
export function isAway(seat: RoomSeat | null | undefined): seat is RoomSeat {
  return !!seat && !seat.isBot && !seat.connected && !seat.botFor;
}

export interface WaitLineProps {
  view: PlayerView;
  room: RoomInfo | null;
  now: number;
  busy?: boolean;
  who?: PlayerId;
  /** Whose turn it is in the latest server view (the table may still be catching up, with no turn shown). */
  waitFor?: PlayerId | null;
  /** A completed trick held on the table: say who takes it. */
  held?: HeldTrick | null;
  onBotFor(p: PlayerId): void;
}

export function WaitLine({ view, room, now, busy = false, who: whoId, waitFor = null, held = null, onBotFor }: WaitLineProps) {
  if (held && !whoId) return <p className="zone__wait">{announceText({ kind: 'trick', p: held.p, points: held.points }, view)}</p>;
  const p = whoId ?? view.turn ?? waitFor;
  // Playback is still catching up to my turn (cards flying, a sweep): never a bare ellipsis.
  if (!p || p === view.me) return <p className="zone__wait">One moment…</p>;
  const seat = room?.seats.find((s): s is RoomSeat => s?.id === p) ?? null;
  if (isAway(seat)) {
    const awayFor = now - (seat.awaySince ?? now);
    const left = Math.max(0, Math.ceil((AWAY_BOT_AFTER_MS - awayFor) / 1000));
    return (
      <div className="zone__wait">
        <span>{seat.name} is away</span>
        {left === 0 ? (
          <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onBotFor(p)}>
            Let a bot play for {seat.name}
          </button>
        ) : (
          <span className="zone__muted">bot option in {left} s</span>
        )}
      </div>
    );
  }
  return (
    <p className="zone__wait">
      {who(view, p)} {VERB[view.phase] ?? 'is thinking'}…
    </p>
  );
}

interface PanelProps {
  view: PlayerView;
  myTurn: boolean;
  busy: boolean;
  wait: ReactNode;
}

export function BidPanel({ view, myTurn, busy, wait, onAct }: PanelProps & { onAct(a: Action): void }) {
  const r = view.round!;
  const bid = view.legal.find((a): a is Extract<Action, { type: 'bid' }> => a.type === 'bid');
  const marr = marriagesInHand(r.hand);
  const why = marr.length
    ? `(${RULES.maxBidBase} + ${marr.map(s => SUIT_TEXT[s]).join(' ')} marriage${marr.length > 1 ? 's' : ''})`
    : '(no marriage)';
  return (
    <>
      <div className="row">
        <div>
          <div className="lbl">Current bid</div>
          <div className="zone__big display">
            {r.bid.amount} <small>· {who(view, r.bid.high)}</small>
          </div>
        </div>
        {r.maxBid > 0 && (
          <div className="zone__max">
            Your max: <b>{r.maxBid}</b>
            <br />
            {why}
          </div>
        )}
      </div>
      <div className="zone__buttons">
        {myTurn ? (
          <>
            <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onAct({ type: 'pass' })}>
              Pass
            </button>
            {bid && (
              <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct(bid)}>
                Bid {bid.amount}
              </button>
            )}
          </>
        ) : (
          wait
        )}
      </div>
    </>
  );
}

/* Mirrors the engine's scoreThrow (no helper exposes it without full totals): at the auto-bid
 * nothing changes, otherwise the bidder loses the bid and each other active player gets
 * floor(RULES.throwPool / others). Keep in sync with packages/engine/src/scoring.ts. */
export function throwCost(view: PlayerView): string {
  const r = view.round!;
  const amount = r.bid.amount;
  if (amount <= RULES.autoBid) return 'Throw in: nobody scores, new deal.';
  const share = Math.floor(RULES.throwPool / Math.max(1, r.active.length - 1));
  return `Throw in: you −${amount}, others +${share} each (0 on the barrel).`;
}

export function DecisionPanel({ view, myTurn, busy, wait, onAct }: PanelProps & { onAct(a: Action): void }) {
  const r = view.round!;
  return (
    <>
      <div className="lbl">
        {who(view, r.bid.high)} won at {r.bid.amount}
      </div>
      {myTurn ? (
        <>
          <p className="zone__text">
            Play this hand or throw in? <span className="zone__muted">{throwCost(view)}</span>
          </p>
          <div className="zone__buttons">
            <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onAct({ type: 'throw' })}>
              Throw in
            </button>
            <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct({ type: 'play' })}>
              Play
            </button>
          </div>
        </>
      ) : (
        <div className="zone__buttons">{wait}</div>
      )}
    </>
  );
}

export interface HandoutPanelProps extends PanelProps {
  given: Partial<Record<PlayerId, Card>>;
  /** The slot the next tapped card goes to. */
  next: PlayerId | null;
  onSlot(p: PlayerId): void;
  onConfirm(): void;
}

/**
 * OG DistributionModal, inline: one labelled slot per recipient (avatar, name, the card or an empty
 * frame). Tapping a hand card fills the next empty slot (or the slot tapped first); tapping a filled
 * slot takes its card back. Then Confirm.
 */
export function HandoutPanel({ view, myTurn, busy, wait, given, next, onSlot, onConfirm }: HandoutPanelProps) {
  const recipients = view.round!.active.filter(p => p !== view.me);
  const done = recipients.filter(p => given[p]).length;
  if (!myTurn) {
    return (
      <>
        <div className="lbl">Hand-out</div>
        <div className="zone__buttons">{wait}</div>
      </>
    );
  }
  return (
    <>
      <div className="row">
        <div className="lbl">
          Handing out · {done} of {recipients.length}
        </div>
        <div className="zone__muted handout__tip">{next ? `Tap a card for ${who(view, next)}.` : 'Tap a slot to take a card back.'}</div>
      </div>
      <div className="slots">
        {recipients.map(p => {
          const seat = view.seats.find(x => x.id === p);
          const card = given[p];
          return (
            <button
              key={p}
              type="button"
              className={`slot ${card ? 'slot--filled' : ''} ${p === next ? 'slot--next' : ''}`}
              data-slot={p}
              aria-label={card ? `Take back ${cardLabel(card)}` : `Give to ${seat?.name ?? who(view, p)}`}
              aria-pressed={p === next}
              disabled={busy}
              onClick={() => onSlot(p)}
            >
              <span className="avatar slot__avatar" aria-hidden="true">
                {seat?.avatar}
              </span>
              <span className="slot__name">{seat?.name ?? who(view, p)}</span>
              {card ? (
                <span className={`card slot__card ${isRed(card) ? 'card--red' : ''}`} aria-hidden="true">
                  <CardFace card={card} />
                </span>
              ) : (
                <span className="slot__empty" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      <div className="zone__buttons">
        <button type="button" className="btn btn--pri" disabled={busy || done < recipients.length} onClick={onConfirm}>
          Confirm hand-out
        </button>
      </div>
    </>
  );
}

export function TrickPanel({ view, myTurn, busy, wait, selected, onPlay }: PanelProps & { selected: Card | null; onPlay(card: Card): void }) {
  const r = view.round!;
  const trump = r.trump ? ` · trump ${SUIT_TEXT[r.trump]}` : '';
  const trickNo = Object.values(r.tricksTaken).reduce((a, b) => a + b, 0) + 1;
  const illegal = selected ? explainIllegal(view, selected) : null;
  return (
    <>
      <div className="lbl">{`Trick ${trickNo}${trump}`}</div>
      <div className="zone__buttons">
        {myTurn ? (
          <button type="button" className="btn btn--pri" disabled={busy || !selected || !!illegal} onClick={() => selected && onPlay(selected)}>
            {selected ? `Play ${textSuits(cardLabel(selected))}` : 'Play'}
          </button>
        ) : (
          wait
        )}
      </div>
    </>
  );
}

export function PausedPanel({ view, busy = false, onAct }: { view: PlayerView; busy?: boolean; onAct(a: Action): void }) {
  const by = view.paused?.by;
  const text = by === view.me ? 'You paused the game.' : `${by ? who(view, by) : 'Someone'} paused the game.`;
  const canResume = view.legal.some(a => a.type === 'resume');
  return (
    <>
      <p className="zone__text">{text}</p>
      {canResume && (
        <div className="zone__buttons">
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct({ type: 'resume' })}>
            Resume
          </button>
        </div>
      )}
    </>
  );
}
