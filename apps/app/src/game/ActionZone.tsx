import type { ReactNode } from 'react';
import { explainIllegal, type Action, type Advice, type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo } from '../net/protocol';
import { BidPanel, DecisionPanel, HandoutPanel, PausedPanel, TrickPanel, WaitLine } from './panels';
import { TalonPanel } from './TalonPanel';
import { CoachLine } from './CoachLine';
import './zone.css';

export { throwCost } from './panels';

export interface ActionZoneProps {
  view: PlayerView;
  room: RoomInfo | null;
  idle: boolean;
  busy: boolean;
  selected: Card | null;
  given: Partial<Record<PlayerId, Card>>;
  /** Hand-out: the slot the next tapped card goes to. */
  next: PlayerId | null;
  hint: string | null;
  coach: boolean;
  advice: Advice | null;
  note: string | null;
  now: number;
  onAct(a: Action): void;
  onPlay(card: Card): void;
  onConfirmHandout(): void;
  onSlot(p: PlayerId): void;
  onBotFor(p: PlayerId): void;
  onWhy(): void;
}

export function zonePhase(view: PlayerView, idle: boolean): string {
  if (view.paused) return 'paused';
  if (view.phase === 'gameEnd') return 'over';
  if (view.phase === 'talon') return idle ? 'talon' : 'wait';
  if (!idle || view.turn !== view.me) return 'wait';
  return view.phase;
}

export function ActionZone(p: ActionZoneProps) {
  const { view } = p;
  const phase = zonePhase(view, p.idle);
  const myTurn = phase === view.phase;
  const wait = <WaitLine view={view} room={p.room} now={p.now} busy={p.busy} onBotFor={p.onBotFor} />;
  let body: ReactNode;
  if (view.paused) body = <PausedPanel view={view} busy={p.busy} onAct={p.onAct} />;
  else if (view.phase === 'gameEnd') body = <p className="zone__text">Game over</p>;
  else if (view.phase === 'talon') body = <TalonPanel view={view} room={p.room} now={p.now} busy={p.busy} idle={p.idle} onAct={p.onAct} onBotFor={p.onBotFor} />;
  else if (view.round?.sittingOut === view.me) {
    body = (
      <>
        <p className="zone__text">You deal and sit out this round.</p>
        {wait}
      </>
    );
  } else {
    switch (view.phase) {
      case 'bidding':
        body = <BidPanel view={view} myTurn={myTurn} busy={p.busy} wait={wait} onAct={p.onAct} />;
        break;
      case 'decision':
        body = <DecisionPanel view={view} myTurn={myTurn} busy={p.busy} wait={wait} onAct={p.onAct} />;
        break;
      case 'handout':
        body = <HandoutPanel view={view} myTurn={myTurn} busy={p.busy} wait={wait} given={p.given} next={p.next} onSlot={p.onSlot} onConfirm={p.onConfirmHandout} />;
        break;
      case 'tricks':
        body = <TrickPanel view={view} myTurn={myTurn} busy={p.busy} wait={wait} selected={p.selected} onPlay={p.onPlay} />;
        break;
    }
  }
  // A raised card the rules forbid explains itself (engine text); the caller's hint wins.
  const hint = p.hint ?? (myTurn && view.phase === 'tricks' && p.selected ? explainIllegal(view, p.selected) : null);
  return (
    <section className="zone panel" data-phase={phase} aria-label="Actions">
      <div className="zone__main">{body}</div>
      {hint && (
        <p className="zone__hint" role="status">
          {hint}
        </p>
      )}
      {p.coach ? (
        <CoachLine advice={myTurn ? p.advice : null} note={p.note} onWhy={p.onWhy} />
      ) : (
        p.note && <p className="zone__note">{p.note}</p>
      )}
    </section>
  );
}
