import type { ReactNode } from 'react';
import { RULES, cardLabel, explainIllegal, marriagesInHand, type Action, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo, RoomSeat } from '../net/protocol';
import { AWAY_BOT_AFTER_MS } from '../net/connection';
import { who } from '../store/notes';
import { SUIT_TEXT, textSuits } from './cards';
import { appLine, lineText, type AppLine } from '../i18n/engineText';

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

export function WaitLine({ view, room, now, busy = false, who: whoId, onBotFor }: { view: PlayerView; room: RoomInfo | null; now: number; busy?: boolean; who?: PlayerId; onBotFor(p: PlayerId): void }) {
  const p = whoId ?? view.turn;
  if (!p || p === view.me) return <p className="zone__wait">…</p>;
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
export function throwCostLine(view: PlayerView): AppLine {
  const r = view.round!;
  const amount = r.bid.amount;
  if (amount <= RULES.autoBid) return appLine('game.throwCost.free');
  const share = Math.floor(RULES.throwPool / Math.max(1, r.active.length - 1));
  return appLine('game.throwCost.paid', { amount, share });
}

export function throwCost(view: PlayerView): string {
  return lineText(throwCostLine(view), view);
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

export function HandoutPanel(props: PanelProps & { given: Partial<Record<PlayerId, Card>>; selected: Card | null; onConfirm(): void }) {
  const { view, myTurn, busy, wait, given, selected, onConfirm } = props;
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
  const text =
    done === recipients.length
      ? 'Both cards chosen. Confirm, or tap ✕ to change.'
      : selected
        ? `Now tap who gets ${textSuits(cardLabel(selected))}.`
        : 'Tap a card, then tap who gets it.';
  return (
    <>
      <div className="lbl">
        Handing out · {done} of {recipients.length}
      </div>
      <p className="zone__text">{text}</p>
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
