import { describe, expect, it } from 'vitest';
import { cardEquals, cardKey, turnOf, talonWaiting, type Action, type Card, type GameEvent, type GameState } from '@tysiac/engine';
import {
  FLIGHT_MS, HOLD_MS, NOTE_MS, advance, applyServer, beginAct, beginPlay, dismissResult, initialClient, isIdle,
  type ClientState, type Step,
} from './client';
import { eventNote } from './notes';
import { botStep, findState, roomInfo, stateMsg, step, viewOf, welcomeMsg } from '../test/fixtures';

const ready = (s: GameState): ClientState => {
  const v = viewOf(s);
  return { ...initialClient, me: 'me', room: roomInfo(), view: v, shown: v };
};
const firstCard = (s: GameState): Card => (viewOf(s).legal.find(a => a.type === 'card') as Extract<Action, { type: 'card' }>).card;
function drain(c: ClientState): { state: ClientState; steps: Step[] } {
  const steps: Step[] = [];
  for (let st = advance(c, false); st; st = advance(c, false)) {
    steps.push(st);
    c = st.state;
  }
  return { state: c, steps };
}

describe('applyServer', () => {
  it('welcome stores me, room and the clock offset', () => {
    const c = applyServer(initialClient, { t: 'welcome', you: 'me', room: roomInfo(), serverTime: 5_000 }, 3_000);
    expect(c.me).toBe('me');
    expect(c.room!.code).toBe('ABCDEF');
    expect(c.clockOffset).toBe(2_000);
  });

  it('a state without events is shown immediately', () => {
    const s = findState(x => x.phase === 'bidding');
    const c = applyServer({ ...initialClient, me: 'me' }, stateMsg(s), 0);
    expect(c.view).toBe(c.shown);
    expect(isIdle(c)).toBe(true);
  });

  it('a state with events is queued and shown lags behind', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1, events } = botStep(s0);
    const c = applyServer(ready(s0), stateMsg(s1, events), 0);
    expect(c.queue.map(e => e.type)).toEqual(['cardPlayed']);
    expect(c.shown!.round!.trick.cards).toHaveLength(1);
    expect(isIdle(c)).toBe(false);
  });

  it('a resync state drops the queue and the pending card', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'me');
    let c = beginPlay(ready(s0), 'p1', firstCard(s0));
    c = { ...c, queue: [{ type: 'paused', p: 'b', audience: 'all' }], needsResync: true };
    const c2 = applyServer(c, stateMsg(s0), 0);
    expect(c2.queue).toEqual([]);
    expect(c2.pending).toBeNull();
    expect(c2.shown).toBe(c2.view);
  });

  it('reject of the pending card rolls it back with a shake and the reason', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'me');
    const card = firstCard(s0);
    const c = applyServer(beginPlay(ready(s0), 'p1', card), { t: 'reject', id: 'p1', code: 'illegalCard', message: 'You must follow ♦' }, 0);
    expect(c.pending).toBeNull();
    expect(c.shake).toBe(cardKey(card));
    expect(c.toast).toBe('You must follow ♦');
  });

  it('ack clears an in-flight action; reject of it shows the reason', () => {
    const s0 = findState(x => x.phase === 'bidding' && turnOf(x) === 'me');
    const c = beginAct(ready(s0), 'a1');
    expect(c.inflight).toBe('a1');
    expect(applyServer(c, { t: 'ack', id: 'a1' }, 0).inflight).toBeNull();
    const r = applyServer(c, { t: 'reject', id: 'a1', code: 'badBid', message: 'Too high' }, 0);
    expect(r.inflight).toBeNull();
    expect(r.toast).toBe('Too high');
  });

  it('ignores a stale state (seq below the last)', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1, events } = botStep(s0);
    const c = applyServer({ ...ready(s0), seq: s1.seq + 1 }, stateMsg(s1, events), 0);
    expect(c.queue).toEqual([]);
    expect(c.seq).toBe(s1.seq + 1);
    expect(c.shown!.round!.trick.cards).toHaveLength(1);
  });

  it('a rematch (finished -> playing) resets seq so the new game at seq 0 is applied', () => {
    const s0 = findState(x => x.phase === 'bidding');
    const old = { ...ready(s0), seq: 300, room: roomInfo({ status: 'finished' }), queue: [{ type: 'dealt' } as GameEvent] };
    const c = applyServer(old, { t: 'room', room: roomInfo({ status: 'playing' }) }, 0);
    expect(c.seq).toBe(-1);
    expect(c.needsResync).toBe(true);
    expect(c.queue).toEqual([]);
    const next = applyServer(c, { ...stateMsg(s0), seq: 0 }, 0);
    expect(next.seq).toBe(0);
    expect(next.shown).toBe(next.view);
    expect(next.needsResync).toBe(false);
  });

  it('a same-seq state replaces the view and skips its events', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1, events } = botStep(s0);
    const queued = applyServer(ready(s0), stateMsg(s1, events), 0);
    const again = applyServer(queued, stateMsg(s1, events), 0);
    expect(again.queue).toHaveLength(1);
    expect(again.view).toEqual(viewOf(s1));
    const idle = applyServer({ ...ready(s1), seq: s1.seq }, stateMsg(s1, events), 0);
    expect(idle.queue).toEqual([]);
    expect(idle.shown).toBe(idle.view);
  });

  it('a welcome then an empty-events state at a newer seq is a silent resync', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1 } = botStep(s0);
    let c = applyServer(ready(s0), welcomeMsg(), 0);
    c = applyServer(c, stateMsg(s1), 0);
    expect(c.queue).toEqual([]);
    expect(c.shown).toBe(c.view);
    expect(c.seq).toBe(s1.seq);
  });

  it('an empty-events newer state mid-playback keeps the queue', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1, events } = botStep(s0);
    const queued = applyServer(ready(s0), stateMsg(s1, events), 0);
    const c = applyServer(queued, { ...stateMsg(s1), seq: s1.seq + 1 }, 0);
    expect(c.queue).toHaveLength(1);
    expect(c.seq).toBe(s1.seq + 1);
    expect(c.shown).not.toBe(c.view);
    expect(advance(c, false)!.kind).toBe('flight');
  });

  it('welcome clears in-flight, pending and queued state', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'me');
    let c = beginAct(beginPlay(ready(s0), 'p1', firstCard(s0)), 'a1');
    c = { ...c, queue: [{ type: 'paused', p: 'b', audience: 'all' }], holding: true };
    c = applyServer(c, welcomeMsg(), 0);
    expect(c.inflight).toBeNull();
    expect(c.pending).toBeNull();
    expect(c.queue).toEqual([]);
    expect(c.holding).toBe(false);
    expect(c.needsResync).toBe(true);
  });

  it('error is stored', () => {
    expect(applyServer(initialClient, { t: 'error', code: 'roomFull', message: 'This room is full' }, 0).error).toEqual({ code: 'roomFull', message: 'This room is full' });
  });
});

describe('advance', () => {
  it('own pending card resolves without a second flight, then holds and sweeps the trick', () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'me' && x.round!.trick.cards.length === 2 && x.round!.hands.me.length > 1);
    const card = firstCard(s0);
    const { state: s1, events } = step(s0, 'me', { type: 'card', card });
    let c = beginPlay(ready(s0), 'p1', card);
    c = applyServer(c, stateMsg(s1, events), 0);

    let st = advance(c, false)!;
    expect(st.kind).toBe('flight');
    expect(st.wait).toBe(0);
    expect(st.state.pending).toBeNull();
    expect(st.state.shown!.round!.trick.cards).toHaveLength(3);
    expect(st.state.shown!.round!.hand.some(x => cardEquals(x, card))).toBe(false);

    st = advance(st.state, false)!;
    expect(st.kind).toBe('hold');
    expect(st.wait).toBe(HOLD_MS);
    expect(st.state.shown!.round!.trick.cards).toHaveLength(3);

    st = advance(st.state, false)!;
    expect(st.kind).toBe('sweep');
    expect(st.sound).toBe('sweep');
    const winner = events.find(e => e.type === 'trickWon')!;
    expect(st.state.sweepTo).toBe(winner.type === 'trickWon' ? winner.p : null);
    expect(st.state.shown!.round!.trick.cards).toEqual([]);
    expect(st.state.shown!.round!.lastTrick!.cards).toHaveLength(3);

    st = advance(st.state, false)!;
    expect(st.kind).toBe('sync');
    expect(st.state.shown).toBe(st.state.view);
    expect(advance(st.state, false)).toBeNull();
  });

  it("an opponent's card flies in with a sound and lowers their card count", () => {
    const s0 = findState(x => x.phase === 'tricks' && turnOf(x) === 'b' && x.round!.trick.cards.length === 1);
    const { state: s1, events } = botStep(s0);
    const c = applyServer(ready(s0), stateMsg(s1, events), 0);
    const st = advance(c, false)!;
    expect(st.kind).toBe('flight');
    expect(st.wait).toBe(FLIGHT_MS);
    expect(st.sound).toBe('card');
    expect(st.state.shown!.round!.trick.cards).toHaveLength(2);
    expect(st.state.shown!.round!.handCounts.b).toBe(c.shown!.round!.handCounts.b - 1);
  });

  it('pauses on the round result until dismissed, then deals the next round', () => {
    const s0 = findState(x => x.phase === 'tricks' && x.rounds.length === 0 && turnOf(x) === 'me' && x.round!.hands.me.length === 1 && x.round!.trick.cards.length === 2);
    const { state: s1, events } = step(s0, 'me', { type: 'card', card: firstCard(s0) });
    let c = applyServer(ready(s0), stateMsg(s1, events), 0);
    const first = drain(c);
    expect(first.steps.at(-1)!.kind).toBe('pause');
    expect(first.state.roundResult!.number).toBe(1);
    expect(advance(first.state, false)).toBeNull();
    c = dismissResult(first.state);
    const second = drain(c);
    expect(second.steps.some(x => x.sound === 'shuffle')).toBe(true);
    expect(second.state.shown).toBe(second.state.view);
    expect(second.state.shown!.round!.number).toBe(2);
    expect(isIdle(second.state)).toBe(true);
  });

  it('plays the turn sound when it becomes my turn', () => {
    const s0 = findState(x => x.phase === 'bidding' && turnOf(x) === 'b' && turnOf(botStep(x).state) === 'me');
    const { state: s1, events } = botStep(s0);
    const { steps } = drain(applyServer(ready(s0), stateMsg(s1, events), 0));
    expect(steps.at(-1)!.kind).toBe('sync');
    expect(steps.at(-1)!.sound).toBe('turn');
  });
});

describe('talon step', () => {
  it('plays the turn sound when I must confirm the talon', () => {
    const s = findState(x => x.phase === 'talon' && x.round!.bid.high !== 'me' && talonWaiting(x).includes('me'));
    const v2 = viewOf(s);
    const step = advance({ ...initialClient, me: 'me', room: roomInfo(), view: v2, shown: viewOf(findState(x => x.phase === 'bidding')), queue: [] }, false)!;
    expect(step.sound).toBe('turn');
  });
  it('stays silent once I have confirmed', () => {
    let s = findState(x => x.phase === 'talon' && x.round!.bid.high !== 'me' && talonWaiting(x).includes('me'));
    s = step(s, 'me', { type: 'ackTalon' }).state;
    const v2 = viewOf(s);
    const st = advance({ ...initialClient, me: 'me', room: roomInfo(), view: v2, shown: viewOf(findState(x => x.phase === 'bidding')), queue: [] }, false)!;
    expect(st.sound).toBeUndefined();
  });
});

describe('eventNote', () => {
  const s = findState(x => x.phase === 'tricks');
  const v = viewOf(s);
  it('leaves marriages to the ticker without the coach', () => {
    expect(eventNote({ type: 'marriage', p: 'b', suit: 'hearts', points: 100, audience: 'all' }, v, false)).toBeNull();
  });
  it('stays quiet for ordinary events without the coach', () => {
    expect(eventNote({ type: 'passed', p: 'b', audience: 'all' }, v, false)).toBeNull();
  });
  it('uses the engine explanation with the coach', () => {
    const e: GameEvent = { type: 'trickWon', p: 'me', cards: [], card: { suit: 'hearts', rank: 'A' }, points: 0, byTrump: true, audience: 'all' };
    expect(eventNote(e, v, true)).toContain('You won with A♥');
  });
});

describe('table fx', () => {
  const v = viewOf(findState(x => x.phase === 'tricks'));
  const base: ClientState = { ...initialClient, me: 'me', room: roomInfo(), view: v, shown: v };
  it('a marriage sets the table fx, and a trump-won trick bursts while it is held', () => {
    const m = advance({ ...base, queue: [{ type: 'marriage', p: 'b', suit: 'hearts', points: 100, audience: 'all' }] }, false)!;
    expect(m.state.fx).toMatchObject({ kind: 'marriage', suit: 'hearts' });
    expect(m.sound).toBe('marriage');
    const won: GameEvent = { type: 'trickWon', p: 'b', cards: [], card: { suit: 'hearts', rank: '9' }, points: 0, byTrump: true, audience: 'all' };
    const hold = advance({ ...base, queue: [won] }, false)!;
    expect(hold.state.fx).toMatchObject({ kind: 'trumpWin' });
    const sweep = advance(hold.state, false)!;
    expect(sweep.state.fx).toBeNull();
  });
});

describe('announcements in the store', () => {
  it('each played event sets the announcement', () => {
    const v = viewOf(findState(x => x.phase === 'tricks'));
    const s: ClientState = { ...initialClient, me: 'me', room: roomInfo(), view: v, shown: v, queue: [{ type: 'passed', p: 'b', audience: 'all' } as GameEvent] };
    const step = advance(s, false)!;
    expect(step.state.announce?.a).toEqual({ kind: 'pass', p: 'b' });
  });
});

describe('received card', () => {
  const v = viewOf(findState(x => x.phase === 'tricks'));
  const base: ClientState = { ...initialClient, me: 'me', room: roomInfo(), view: v, shown: v };
  it('a hand-out to me records the received card and who gave it', () => {
    const e = { type: 'handedOut', p: 'b', recipients: ['me', 'z'], cards: { me: { suit: 'hearts', rank: 'Q' } }, audience: ['me'] } as GameEvent;
    const step = advance({ ...base, queue: [e] }, false)!;
    expect(step.state.received).toEqual({ card: { suit: 'hearts', rank: 'Q' }, from: 'b' });
    expect(step.wait).toBe(NOTE_MS);
  });
  it('the first card played clears the received overlay', () => {
    const e = { type: 'cardPlayed', p: 'b', card: { suit: 'clubs', rank: '9' }, audience: 'all' } as GameEvent;
    const step = advance({ ...base, received: { card: { suit: 'hearts', rank: 'Q' }, from: 'b' }, queue: [e] }, false)!;
    expect(step.state.received).toBeNull();
  });
  it('the bidder does not get a received overlay', () => {
    const e = { type: 'handedOut', p: 'me', recipients: ['b', 'z'], cards: {}, audience: ['me'] } as GameEvent;
    expect(advance({ ...base, queue: [e] }, false)!.state.received).toBeNull();
  });
});

describe('sounds for round end and game win', () => {
  it('round end and game win have their own sounds', () => {
    const v = viewOf(findState(x => x.phase === 'tricks'));
    const summary = viewOf(findState(x => x.rounds.length > 0)).rounds[0];
    const base: ClientState = { ...initialClient, me: 'me', room: roomInfo(), view: v, shown: v };
    expect(advance({ ...base, queue: [{ type: 'roundScored', summary, audience: 'all' } as GameEvent] }, false)!.sound).toBe('roundEnd');
    const won = { type: 'gameWon', p: 'me', totals: {}, audience: 'all' } as GameEvent;
    expect(advance({ ...base, queue: [{ type: 'roundScored', summary, audience: 'all' } as GameEvent, won] }, false)!.sound).toBe('gameWin');
  });
});
