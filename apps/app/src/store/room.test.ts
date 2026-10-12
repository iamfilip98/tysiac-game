import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardKey, turnOf, type Action, type Card, type GameState } from '@tysiac/engine';
import { pump, setSoundSink, stepWait, useRoom } from './room';
import { FakeConnection } from '../test/fakes';
import { botStep, findState, stateMsg, viewOf, welcomeMsg } from '../test/fixtures';

function joinAt(s: GameState): FakeConnection {
  const conn = new FakeConnection();
  useRoom.getState().attach(conn);
  conn.push(welcomeMsg());
  conn.push(stateMsg(s));
  return conn;
}
const legalCard = (s: GameState): Card => (viewOf(s).legal.find(a => a.type === 'card') as Extract<Action, { type: 'card' }>).card;

describe('useRoom', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useRoom.getState().detach();
  });
  afterEach(() => {
    useRoom.getState().detach();
    setSoundSink(() => {});
    vi.useRealTimers();
  });

  it('attach follows the connection status; detach closes and resets', () => {
    const conn = new FakeConnection();
    useRoom.getState().attach(conn);
    expect(useRoom.getState().status).toBe('open');
    conn.setStatus('reconnecting');
    expect(useRoom.getState().status).toBe('reconnecting');
    useRoom.getState().detach();
    expect(conn.status).toBe('closed');
    expect(useRoom.getState().status).toBe('idle');
    expect(useRoom.getState().view).toBeNull();
  });

  it('playCard is optimistic and sends exactly one act even when tapped twice', () => {
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    const card = legalCard(s0);
    useRoom.getState().playCard(card);
    useRoom.getState().playCard(card);
    expect(useRoom.getState().pending?.card).toEqual(card);
    expect(conn.acts()).toHaveLength(1);
    expect(conn.acts()[0].action).toEqual({ type: 'card', card });
  });

  it('a reject rolls the card back with a shake', () => {
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    const card = legalCard(s0);
    useRoom.getState().playCard(card);
    conn.push({ t: 'reject', id: conn.acts()[0].id, code: 'illegalCard', message: 'You must follow ♦' });
    expect(useRoom.getState().pending).toBeNull();
    expect(useRoom.getState().shake).toBe(cardKey(card));
    expect(useRoom.getState().toast).toBe('You must follow ♦');
    useRoom.getState().clearShake();
    expect(useRoom.getState().shake).toBeNull();
  });

  it('rolls back at once when offline', () => {
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    conn.accept = false;
    useRoom.getState().playCard(legalCard(s0));
    expect(useRoom.getState().pending).toBeNull();
    expect(useRoom.getState().toast).toBe("You're offline — reconnecting…");
  });

  it('act marks the action in flight until ack', () => {
    const s0 = findState(s => s.phase === 'bidding' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    useRoom.getState().act({ type: 'pass' });
    expect(useRoom.getState().inflight).toBe(conn.acts()[0].id);
    conn.push({ t: 'ack', id: conn.acts()[0].id });
    expect(useRoom.getState().inflight).toBeNull();
  });

  it('a second act while one is in flight sends nothing', () => {
    const s0 = findState(s => s.phase === 'bidding' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    expect(useRoom.getState().act({ type: 'pass' })).toBe(true);
    expect(useRoom.getState().act({ type: 'pass' })).toBe(false);
    expect(conn.acts()).toHaveLength(1);
  });

  it('plays queued events on timers until the table catches up, with sounds', () => {
    const sink = vi.fn();
    setSoundSink(sink);
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'b' && s.round!.trick.cards.length === 1);
    const conn = joinAt(s0);
    const { state: s1, events } = botStep(s0);
    conn.push(stateMsg(s1, events));
    expect(useRoom.getState().shown).not.toBe(useRoom.getState().view);
    expect(sink).toHaveBeenCalledWith('card');
    vi.advanceTimersByTime(3000);
    expect(useRoom.getState().shown).toBe(useRoom.getState().view);
    pump();
    expect(useRoom.getState().shown).toBe(useRoom.getState().view);
  });

  it('a newer state with no events and an empty queue syncs shown to view', () => {
    const s0 = findState(s => s.phase === 'bidding' && turnOf(s) === 'me');
    const conn = joinAt(s0);
    const s1 = { ...s0, seq: s0.seq + 1 };
    conn.push(stateMsg(s1, []));
    const st = useRoom.getState();
    expect(st.seq).toBe(s1.seq);
    expect(st.shown).toBe(st.view);
  });

  it('detach clears playback timers so nothing fires later', () => {
    const sink = vi.fn();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'b' && s.round!.trick.cards.length === 1);
    const conn = joinAt(s0);
    const { state: s1, events } = botStep(s0);
    conn.push(stateMsg(s1, events));
    useRoom.getState().detach();
    setSoundSink(sink);
    vi.advanceTimersByTime(5000);
    expect(sink).not.toHaveBeenCalled();
    expect(useRoom.getState().view).toBeNull();
  });

  it('fatal errors close the connection', () => {
    const conn = new FakeConnection();
    useRoom.getState().attach(conn);
    conn.push({ t: 'error', code: 'roomFull', message: 'This room is full' });
    expect(conn.status).toBe('closed');
    expect(useRoom.getState().error).toEqual({ code: 'roomFull', message: 'This room is full' });
  });

  it('stepWait scales with speed, fast mode and reduced motion', () => {
    const st = { state: useRoom.getState(), wait: 1000, kind: 'hold' as const };
    const fl = { ...st, kind: 'flight' as const };
    expect(stepWait(st, { speed: 'normal', reduced: false, fast: false })).toBe(1000);
    expect(stepWait(st, { speed: 'fast', reduced: false, fast: false })).toBe(500);
    expect(stepWait(st, { speed: 'normal', reduced: false, fast: true })).toBe(100);
    expect(stepWait(fl, { speed: 'normal', reduced: true, fast: false })).toBe(0);
    expect(stepWait(st, { speed: 'normal', reduced: true, fast: false })).toBe(1000);
  });
});
