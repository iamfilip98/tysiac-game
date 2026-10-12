import { create } from 'zustand';
import type { Action, Card } from '@tysiac/engine';
import type { ClientMessage, ServerMessage } from '../net/protocol';
import { FATAL_ERRORS, type ConnStatus, type RoomConnection } from '../net/connection';
import { isFastLocal } from '../net/service';
import { usePrefs, type Speed } from './prefs';
import {
  advance, applyServer, beginAct, beginPlay, dismissReceived, dismissResult, initialClient,
  type ClientState, type SoundName, type Step,
} from './client';

export interface RoomStore extends ClientState {
  status: ConnStatus | 'idle';
  conn: RoomConnection | null;
  attach(conn: RoomConnection): void;
  detach(): void;
  send(msg: ClientMessage): boolean;
  /** False (nothing sent) when another action is still in flight. */
  act(action: Action): boolean;
  playCard(card: Card): void;
  dismissResult(): void;
  /** Closes the received-card banner (the card stays marked in the hand). */
  clearReceived(): void;
  /** Ends the hold of a completed trick now (tap on the table). */
  skipHold(): void;
  clearToast(): void;
  clearShake(): void;
}

const OFFLINE = "You're offline — reconnecting…";
let timer: ReturnType<typeof setTimeout> | null = null;
let offs: (() => void)[] = [];
let sink: (s: SoundName) => void = () => {};
let counter = 0;
const prefix = Math.random().toString(36).slice(2, 6);

export const newId = (): string => `${prefix}${++counter}`;

export function setSoundSink(fn: (s: SoundName) => void): void {
  sink = fn;
}

export function stepWait(step: Step, o: { speed: Speed; reduced: boolean; fast: boolean }): number {
  if (o.reduced && (step.kind === 'flight' || step.kind === 'sweep')) return 0;
  const factor = o.fast ? 0.1 : o.speed === 'fast' ? 0.5 : 1;
  return Math.round(step.wait * factor);
}

export function coachOn(s: Pick<ClientState, 'room' | 'me'>): boolean {
  return !!s.room?.seats.find(x => x?.id === s.me)?.coach;
}

function clearTimer(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const useRoom = create<RoomStore>()((set, get) => ({
  ...initialClient,
  status: 'idle',
  conn: null,
  attach(conn) {
    get().detach();
    offs = [
      conn.onMessage(receive),
      conn.onStatus(status => {
        if (status === 'closed') clearTimer();
        set({ status });
      }),
    ];
    set({ conn, status: conn.status });
  },
  detach() {
    for (const off of offs) off();
    offs = [];
    get().conn?.close();
    clearTimer();
    set({ ...initialClient, conn: null, status: 'idle' });
  },
  send(msg) {
    return get().conn?.send(msg) ?? false;
  },
  act(action) {
    if (get().inflight) return false;
    const id = newId();
    set(s => beginAct(s, id));
    if (!get().send({ t: 'act', id, action })) receive({ t: 'reject', id, code: 'offline', message: OFFLINE });
    return true;
  },
  playCard(card) {
    const s = get();
    if (s.pending || s.inflight) return;
    const id = newId();
    set(st => beginPlay(st, id, card));
    sink('card');
    if (!get().send({ t: 'act', id, action: { type: 'card', card } })) receive({ t: 'reject', id, code: 'offline', message: OFFLINE });
  },
  clearReceived() {
    set(s => dismissReceived(s));
  },
  skipHold() {
    if (!get().holding || get().roundResult) return;
    clearTimer();
    pump();
  },
  dismissResult() {
    set(s => dismissResult(s));
    pump();
  },
  clearToast() {
    set({ toast: null });
  },
  clearShake() {
    set({ shake: null });
  },
}));

function receive(msg: ServerMessage): void {
  const conn = useRoom.getState().conn;
  useRoom.setState(s => applyServer(s, msg, Date.now()));
  if (msg.t === 'error' && FATAL_ERRORS.has(msg.code)) conn?.close();
  if (msg.t === 'state') {
    // Always drive playback; with nothing queued this syncs `shown` to `view`.
    if (useRoom.getState().queue.length === 0) clearTimer();
    pump();
  }
}

/** Applies the next playback step now and schedules the one after it. */
export function pump(): void {
  if (timer) return;
  const s = useRoom.getState();
  const step = advance(s, coachOn(s));
  if (!step) return;
  useRoom.setState(step.state);
  if (step.sound) sink(step.sound);
  const wait = stepWait(step, { speed: usePrefs.getState().speed, reduced: reducedMotion(), fast: isFastLocal() });
  timer = setTimeout(() => {
    timer = null;
    pump();
  }, wait);
}

// e2e only (?local=1&fast=1): screenshot specs stage table states (a held trick, a marriage) through the store.
if (typeof window !== 'undefined' && isFastLocal()) (window as unknown as { __tysiacRoom?: typeof useRoom }).__tysiacRoom = useRoom;
