import type { ReactNode } from 'react';
import { RULES, explainIllegal, marriagesInHand, type Action, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo, RoomSeat } from '../net/protocol';
import { AWAY_BOT_AFTER_MS } from '../net/connection';
import { who } from '../store/notes';
import { SUIT_TEXT, textSuits } from './cards';
import { appLine, cardText, lineText, type AppLine } from '../i18n/engineText';
import { useT } from '../i18n/useT';
import type { MsgKey } from '../i18n';

const WAIT: Partial<Record<PlayerView['phase'], MsgKey & `game.wait.${string}`>> = {
  bidding: 'game.wait.bidding',
  decision: 'game.wait.decision',
  handout: 'game.wait.handout',
  tricks: 'game.wait.tricks',
};

/** A human seat that is disconnected with no bot covering for it. */
export function isAway(seat: RoomSeat | null | undefined): seat is RoomSeat {
  return !!seat && !seat.isBot && !seat.connected && !seat.botFor;
}

export function WaitLine({ view, room, now, busy = false, who: whoId, onBotFor }: { view: PlayerView; room: RoomInfo | null; now: number; busy?: boolean; who?: PlayerId; onBotFor(p: PlayerId): void }) {
  const t = useT();
  const p = whoId ?? view.turn;
  if (!p || p === view.me) return <p className="zone__wait">…</p>;
  const seat = room?.seats.find((s): s is RoomSeat => s?.id === p) ?? null;
  if (isAway(seat)) {
    const awayFor = now - (seat.awaySince ?? now);
    const left = Math.max(0, Math.ceil((AWAY_BOT_AFTER_MS - awayFor) / 1000));
    return (
      <div className="zone__wait">
        <span>{t('game.away', { name: seat.name })}</span>
        {left === 0 ? (
          <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onBotFor(p)}>
            {t('game.botFor', { name: seat.name })}
          </button>
        ) : (
          <span className="zone__muted">{t('game.botIn', { n: left })}</span>
        )}
      </div>
    );
  }
  return (
    <p className="zone__wait">{t(WAIT[view.phase] ?? 'game.wait.other', { player: who(view, p) })}</p>
  );
}

interface PanelProps {
  view: PlayerView;
  myTurn: boolean;
  busy: boolean;
  wait: ReactNode;
}

export function BidPanel({ view, myTurn, busy, wait, onAct }: PanelProps & { onAct(a: Action): void }) {
  const t = useT();
  const r = view.round!;
  const bid = view.legal.find((a): a is Extract<Action, { type: 'bid' }> => a.type === 'bid');
  const marr = marriagesInHand(r.hand);
  const why = marr.length
    ? t('game.bid.whyMarriages', { base: RULES.maxBidBase, suits: marr.map(s => SUIT_TEXT[s]).join(' '), n: marr.length })
    : t('game.bid.whyNone');
  return (
    <>
      <div className="row">
        <div>
          <div className="lbl">{t('game.bid.current')}</div>
          <div className="zone__big display">
            {r.bid.amount} <small>· {who(view, r.bid.high)}</small>
          </div>
        </div>
        {r.maxBid > 0 && (
          <div className="zone__max">
            {t('game.bid.yourMax')} <b>{r.maxBid}</b>
            <br />
            {why}
          </div>
        )}
      </div>
      <div className="zone__buttons">
        {myTurn ? (
          <>
            <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onAct({ type: 'pass' })}>
              {t('game.pass')}
            </button>
            {bid && (
              <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct(bid)}>
                {t('game.bid.button', { n: bid.amount })}
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
  const t = useT();
  const r = view.round!;
  return (
    <>
      <div className="lbl">
        {t(r.bid.high === view.me ? 'game.decision.won.you' : 'game.decision.won', { player: who(view, r.bid.high), amount: r.bid.amount })}
      </div>
      {myTurn ? (
        <>
          <p className="zone__text">
            {t('game.decision.question')} <span className="zone__muted">{throwCost(view)}</span>
          </p>
          <div className="zone__buttons">
            <button type="button" className="btn btn--sec" disabled={busy} onClick={() => onAct({ type: 'throw' })}>
              {t('game.decision.throw')}
            </button>
            <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct({ type: 'play' })}>
              {t('game.decision.play')}
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
  const t = useT();
  const recipients = view.round!.active.filter(p => p !== view.me);
  const done = recipients.filter(p => given[p]).length;
  if (!myTurn) {
    return (
      <>
        <div className="lbl">{t('game.handout.title')}</div>
        <div className="zone__buttons">{wait}</div>
      </>
    );
  }
  const text =
    done === recipients.length
      ? t('game.handout.done')
      : selected
        ? t('game.handout.pickTarget', { card: textSuits(cardText(selected)) })
        : t('game.handout.pickCard');
  return (
    <>
      <div className="lbl">{t('game.handout.progress', { done, total: recipients.length })}</div>
      <p className="zone__text">{text}</p>
      <div className="zone__buttons">
        <button type="button" className="btn btn--pri" disabled={busy || done < recipients.length} onClick={onConfirm}>
          {t('game.handout.confirm')}
        </button>
      </div>
    </>
  );
}

export function TrickPanel({ view, myTurn, busy, wait, selected, onPlay }: PanelProps & { selected: Card | null; onPlay(card: Card): void }) {
  const t = useT();
  const r = view.round!;
  const trickNo = Object.values(r.tricksTaken).reduce((a, b) => a + b, 0) + 1;
  const illegal = selected ? explainIllegal(view, selected) : null;
  return (
    <>
      <div className="lbl">{r.trump ? t('game.trick.titleTrump', { n: trickNo, suit: SUIT_TEXT[r.trump] }) : t('game.trick.title', { n: trickNo })}</div>
      <div className="zone__buttons">
        {myTurn ? (
          <button type="button" className="btn btn--pri" disabled={busy || !selected || !!illegal} onClick={() => selected && onPlay(selected)}>
            {selected ? t('game.trick.playCard', { card: textSuits(cardText(selected)) }) : t('game.trick.play')}
          </button>
        ) : (
          wait
        )}
      </div>
    </>
  );
}

export function PausedPanel({ view, busy = false, onAct }: { view: PlayerView; busy?: boolean; onAct(a: Action): void }) {
  const t = useT();
  const by = view.paused?.by;
  const text = by === view.me ? t('game.paused.you') : t('game.paused', { player: by ? who(view, by) : t('common.someone') });
  const canResume = view.legal.some(a => a.type === 'resume');
  return (
    <>
      <p className="zone__text">{text}</p>
      {canResume && (
        <div className="zone__buttons">
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => onAct({ type: 'resume' })}>
            {t('game.resume')}
          </button>
        </div>
      )}
    </>
  );
}
