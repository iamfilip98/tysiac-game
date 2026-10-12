import {
  cardEquals, cardKey,
  type Card, type GameEvent, type PlayerId, type PlayerView, type RoundSummary, type RoundView, type Suit,
} from '@tysiac/engine';
import type { RoomInfo, ServerMessage } from '../net/protocol';
import { eventNote } from './notes';
import { announcementFor, type Announcement } from '../game/announce';

export type SoundName = 'card' | 'shuffle' | 'sweep' | 'turn';

export const FLIGHT_MS = 280;
export const HOLD_MS = 1000;
export const SWEEP_MS = 380;
export const DEAL_MS = 400;
export const NOTE_MS = 700;
export const RECEIVED_MS = 4000;

export type TableFx = { kind: 'marriage'; suit: Suit; id: number } | { kind: 'trumpWin'; id: number };
let fxId = 0;
let annId = 0;

export interface ClientState {
  me: PlayerId | null;
  room: RoomInfo | null;
  /** serverTime − local time at welcome (to compare with awaySince). */
  clockOffset: number;
  /** Seq of the last applied `state` message (-1 before the first, reset on welcome). */
  seq: number;
  /** Set on welcome: the next state replaces everything silently (no animation). */
  needsResync: boolean;
  /** Latest view from the server. */
  view: PlayerView | null;
  /** What the table shows; catches up with `view` as the event queue plays. */
  shown: PlayerView | null;
  queue: GameEvent[];
  /** The completed trick at the head of the queue is being held on the table. */
  holding: boolean;
  /** Winner of the last swept trick (exit animation target). */
  sweepTo: PlayerId | null;
  /** The latest table event, as a line of text. */
  announce: { a: Announcement; id: number } | null;
  /** A card just handed to me, and by whom (overlay + highlight in hand). */
  received: { card: Card; from: PlayerId } | null;
  /** Transient table effect (marriage ring, trump burst). */
  fx: TableFx | null;
  /** Card played optimistically, awaiting the server. */
  pending: { id: string; card: Card } | null;
  /** Non-card action awaiting ack/reject. */
  inflight: string | null;
  /** cardKey of a card that bounced back. */
  shake: string | null;
  toast: string | null;
  roundResult: RoundSummary | null;
  note: string | null;
  error: { code: string; message: string } | null;
}

export const initialClient: ClientState = {
  me: null, room: null, clockOffset: 0, seq: -1, needsResync: false, view: null, shown: null, queue: [], holding: false, sweepTo: null, fx: null, announce: null, received: null,
  pending: null, inflight: null, shake: null, toast: null, roundResult: null, note: null, error: null,
};

export function applyServer(s: ClientState, msg: ServerMessage, localNow: number): ClientState {
  switch (msg.t) {
    case 'welcome':
      return { ...s, me: msg.you, room: msg.room, clockOffset: msg.serverTime - localNow, seq: -1, needsResync: true, queue: [], holding: false, pending: null, inflight: null, error: null };
    case 'room':
      // Rematch: the new game restarts at seq 0, so forget the finished game's seq and resync on its first state.
      if (s.room?.status === 'finished' && msg.room.status === 'playing') {
        return {
          ...s, room: msg.room, seq: -1, needsResync: true, queue: [], holding: false, roundResult: null,
          pending: null, inflight: null, note: null, sweepTo: null, fx: null, announce: null, received: null,
        };
      }
      return { ...s, room: msg.room };
    case 'state':
      // Older than what we have applied: stale, ignore.
      if (msg.seq < s.seq) return s;
      // Same seq: the server re-broadcast a changed view (e.g. botFor toggle). Take the
      // view, skip the events (already applied), leave any playback/optimistic state alone.
      if (msg.seq === s.seq) {
        const idle = s.queue.length === 0 && !s.holding;
        return { ...s, view: msg.view, shown: idle ? msg.view : s.shown };
      }
      // First state after a (re)connect: replace everything, no animation.
      if (s.needsResync || s.shown === null) {
        return {
          ...s, seq: msg.seq, needsResync: false, view: msg.view, shown: msg.view, queue: [], holding: false,
          pending: null, inflight: null, note: null, sweepTo: null, fx: null, announce: null, received: null, roundResult: null,
        };
      }
      // Newer state: queue its events (possibly none, e.g. choosing to play); `advance` syncs `shown`.
      return { ...s, seq: msg.seq, view: msg.view, queue: [...s.queue, ...msg.events] };
    case 'ack':
      return s.inflight === msg.id ? { ...s, inflight: null } : s;
    case 'reject':
      if (s.pending && s.pending.id === msg.id) {
        return { ...s, pending: null, shake: cardKey(s.pending.card), toast: msg.message };
      }
      if (s.inflight === msg.id) return { ...s, inflight: null, toast: msg.message };
      return s;
    case 'error':
      return { ...s, error: { code: msg.code, message: msg.message } };
    case 'pong':
      return s;
  }
}

export function beginPlay(s: ClientState, id: string, card: Card): ClientState {
  return { ...s, pending: { id, card }, shake: null, toast: null };
}

export function beginAct(s: ClientState, id: string): ClientState {
  return { ...s, inflight: id, toast: null };
}

export function dismissResult(s: ClientState): ClientState {
  return { ...s, roundResult: null };
}

/** Nothing is animating or waiting for the player to dismiss: actions may be offered. */
export function isIdle(s: Pick<ClientState, 'queue' | 'shown' | 'view' | 'roundResult' | 'holding'>): boolean {
  return s.queue.length === 0 && s.shown === s.view && s.roundResult === null && !s.holding;
}

function mapRound(v: PlayerView, f: (r: RoundView) => RoundView): PlayerView {
  return v.round ? { ...v, round: f(v.round) } : v;
}

export function withCardPlayed(v: PlayerView, p: PlayerId, card: Card): PlayerView {
  return {
    ...mapRound(v, r => ({
      ...r,
      hand: p === v.me ? r.hand.filter(c => !cardEquals(c, card)) : r.hand,
      handCounts: { ...r.handCounts, [p]: Math.max(0, (r.handCounts[p] ?? 0) - 1) },
      trick: { ...r.trick, cards: [...r.trick.cards, { p, card }] },
    })),
    turn: null,
  };
}

export function withTrickWon(v: PlayerView, e: Extract<GameEvent, { type: 'trickWon' }>): PlayerView {
  return mapRound(v, r => ({
    ...r,
    trick: { leader: e.p, cards: [] },
    lastTrick: { cards: e.cards, winner: e.p, points: e.points },
    played: [...r.played, ...e.cards.map(t => t.card)],
    tricksTaken: { ...r.tricksTaken, [e.p]: (r.tricksTaken[e.p] ?? 0) + 1 },
    trickPoints: { ...r.trickPoints, [e.p]: (r.trickPoints[e.p] ?? 0) + e.points },
  }));
}

export function withMarriage(v: PlayerView, e: Extract<GameEvent, { type: 'marriage' }>): PlayerView {
  return mapRound(v, r => ({
    ...r,
    trump: e.suit,
    marriages: { ...r.marriages, [e.p]: [...(r.marriages[e.p] ?? []), e.suit] },
  }));
}

export type StepKind = 'flight' | 'hold' | 'sweep' | 'pause' | 'beat' | 'sync';
export interface Step {
  state: ClientState;
  /** How long to wait before the next step (before speed scaling). */
  wait: number;
  kind: StepKind;
  sound?: SoundName;
}

/** Plays the next queued event onto `shown`. Returns null when there is nothing to do (or a sheet blocks). */
function withAnnounce(step: Step, e: GameEvent, me: PlayerId | null): Step {
  const a = announcementFor(e, me);
  return a ? { ...step, state: { ...step.state, announce: { a, id: ++annId } } } : step;
}

export function advance(s: ClientState, coach: boolean): Step | null {
  const step = advanceRaw(s, coach);
  const e = s.queue[0];
  if (!step || !e) return step;
  if (e.type === 'trickWon' && s.holding) return step;
  return withAnnounce(step, e, s.me);
}

function advanceRaw(s: ClientState, coach: boolean): Step | null {
  if (s.roundResult) return null;
  const e = s.queue[0];
  if (!e) {
    if (s.view && s.shown !== s.view) {
      const sound: SoundName | undefined = s.view.turn === s.me && s.view.phase !== 'gameEnd' ? 'turn' : undefined;
      return { state: { ...s, shown: s.view, holding: false }, wait: 0, kind: 'sync', sound };
    }
    return null;
  }
  const shown = s.shown!;
  const rest = s.queue.slice(1);
  const note = () => eventNote(e, s.view ?? shown, coach) ?? s.note;
  switch (e.type) {
    case 'cardPlayed': {
      const mine = e.p === s.me && s.pending !== null && cardEquals(s.pending.card, e.card);
      return {
        state: { ...s, queue: rest, shown: withCardPlayed(shown, e.p, e.card), pending: mine ? null : s.pending },
        wait: mine ? 0 : FLIGHT_MS,
        kind: 'flight',
        sound: mine ? undefined : 'card',
      };
    }
    case 'trickWon':
      if (!s.holding) return { state: { ...s, holding: true, note: note(), fx: e.byTrump ? { kind: 'trumpWin', id: ++fxId } : s.fx }, wait: HOLD_MS, kind: 'hold' };
      return {
        state: { ...s, queue: rest, holding: false, sweepTo: e.p, fx: null, shown: withTrickWon(shown, e) },
        wait: SWEEP_MS,
        kind: 'sweep',
        sound: 'sweep',
      };
    case 'roundScored':
    case 'threw':
      return { state: { ...s, queue: rest, roundResult: e.summary, note: note() }, wait: 0, kind: 'pause' };
    case 'dealt':
      return { state: { ...s, queue: rest, note: null, sweepTo: null, fx: null, received: null }, wait: DEAL_MS, kind: 'beat', sound: 'shuffle' };
    case 'marriage':
      return { state: { ...s, queue: rest, shown: withMarriage(shown, e), note: note(), fx: { kind: 'marriage', suit: e.suit, id: ++fxId } }, wait: NOTE_MS, kind: 'beat' };
    case 'biddingWon':
    case 'wykladana':
      return { state: { ...s, queue: rest, note: note() }, wait: NOTE_MS, kind: 'beat' };
    case 'handedOut': {
      const card = s.me && e.p !== s.me ? e.cards[s.me] : undefined;
      return { state: { ...s, queue: rest, received: card ? { card, from: e.p } : s.received }, wait: card ? NOTE_MS : 0, kind: 'beat' };
    }
    case 'bid':
    case 'passed':
      return { state: { ...s, queue: rest }, wait: NOTE_MS / 2, kind: 'beat' };
    default:
      return { state: { ...s, queue: rest }, wait: 0, kind: 'beat' };
  }
}
