import { describe, it, expect } from 'vitest';
import type { Action, Card, GameState, PlayerId, RoundSummary, Seat } from '../src/types';
import { createGame } from '../src/game';
import { reduce } from '../src/reduce';
import { actionsEqual, legalActions, turnOf } from '../src/actions';
import { viewFor } from '../src/view';
import { botAction } from '../src/bot';
import { makeRandom } from '../src/rng';
import { cardKey } from '../src/cards';
import { SEATS3, SEATS4, cardKeysIn, hiddenCardKeys } from './helpers';

// Full run (>= 2,000 games, ~130 s): `pnpm --filter @tysiac/engine test:sim` (SIM_FULL=1).
// The default suite runs a 10% sample to stay fast.
const FULL = process.env.SIM_FULL === '1' || process.env.SIM_FULL === 'true';
const GAMES_3P = FULL ? 1200 : 120;
const GAMES_4P = FULL ? 800 : 80;
const FULL_VIEW_CHECK_GAMES = 100; // per mode: check every seat's view at every step
const MAX_STEPS = 20_000;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Independent re-statement of spec §3.9 rounding.
const r10 = (n: number) => (n % 10 >= 6 ? n - (n % 10) + 10 : n - (n % 10));
const barrel = (t: number) => t >= 800 && t < 1000;

function roundCards(s: GameState): Card[] {
  const r = s.round!;
  const cards = [
    ...Object.values(r.hands).flat(),
    ...r.trick.cards.map(t => t.card),
    ...Object.values(r.tricksWon).flat(2),
  ];
  if (s.phase === 'bidding') cards.push(...r.talon);
  return cards;
}

function checkNoLeak(s: GameState, me: PlayerId, tag: string): void {
  const hidden = hiddenCardKeys(s, me);
  for (const k of cardKeysIn(viewFor(s, me))) assert(!hidden.has(k), `${tag}: view for ${me} leaks ${k}`);
}

const tally = {
  thrown100: 0, thrownOver100: 0, failed: 0, made: 0, barrel: 0, sittingOutScored: 0, marriage: 0, wykladana: 0,
};

function checkSummary(sum: RoundSummary, prev: Record<PlayerId, number>, tag: string): void {
  if (sum.outcome === 'thrown') (sum.bid > 100 ? tally.thrownOver100++ : tally.thrown100++);
  else if (sum.outcome === 'failed') tally.failed++;
  else tally.made++;
  if (sum.wykladana) tally.wykladana++;
  for (const pr of sum.players) {
    if (barrel(prev[pr.playerId])) tally.barrel++;
    if (pr.sittingOut && pr.scoreChange !== 0) tally.sittingOutScored++;
  }
  for (const pr of sum.players) {
    const before = prev[pr.playerId];
    assert(pr.newTotalScore === before + pr.scoreChange, `${tag}: total mismatch for ${pr.playerId}`);
    const onBarrel = barrel(before);
    if (sum.outcome === 'thrown') {
      let expected = 0;
      if (sum.bid > 100) {
        if (pr.playerId === sum.bidder) expected = -sum.bid;
        else if (!pr.sittingOut && !onBarrel) expected = 60;
      }
      assert(pr.scoreChange === expected, `${tag}: throw change ${pr.scoreChange} != ${expected} for ${pr.playerId}`);
      continue;
    }
    if (pr.playerId === sum.bidder) {
      const made = pr.totalRoundPoints >= sum.bid;
      assert(sum.outcome === (made ? 'made' : 'failed'), `${tag}: outcome mismatch`);
      assert(pr.scoreChange === (made ? r10(pr.totalRoundPoints) : -sum.bid), `${tag}: bidder change wrong`);
    } else if (onBarrel) {
      assert(pr.scoreChange === 0, `${tag}: barrel player ${pr.playerId} scored`);
    } else {
      assert(pr.scoreChange === r10(pr.totalRoundPoints), `${tag}: defender change wrong`);
    }
  }
  if (sum.outcome !== 'thrown') {
    const trickTotal = sum.players.filter(p => !p.sittingOut).reduce((t, p) => t + p.trickPoints, 0);
    assert(trickTotal === 120, `${tag}: trick points ${trickTotal} != 120`);
  }
}

function deepFreeze<T>(x: T): T {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) deepFreeze(v);
  }
  return x;
}

/**
 * Bots never throw in above 100 (it is always worse than playing), but people do: a quarter of those
 * decisions throw here, so the throw-above-100 scoring branch is still exercised.
 */
function humanish(s: GameState, p: PlayerId, action: Action, rand: () => number): Action {
  const over100 = s.phase === 'decision' && (s.round?.bid.amount ?? 0) > 100;
  return over100 && rand() < 0.25 && legalActions(s, p).some(a => a.type === 'throw') ? { type: 'throw' } : action;
}

interface Played {
  state: GameState;
  log: Array<{ p: PlayerId; action: Action }>;
}

function playGame(seed: string, seats: Seat[], firstDealer: number, fullViews: boolean, jsonRoundTrip = false): Played {
  const rand = makeRandom(`bots:${seed}`);
  let s = createGame({ seed, seats, maxPlayers: seats.length as 3 | 4, firstDealer });
  const log: Played['log'] = [];
  const roundEnds: number[] = [];
  let steps = 0;
  while (s.phase !== 'gameEnd') {
    const tag = `${seed}#${steps}`;
    assert(++steps < MAX_STEPS, `${seed}: did not terminate`);
    const p = turnOf(s);
    assert(p, `${tag}: nobody to act`);
    if (fullViews) for (const seat of seats) checkNoLeak(s, seat.id, tag);
    else checkNoLeak(s, p, tag);
    const action = humanish(s, p, botAction(viewFor(s, p), rand), rand);
    assert(legalActions(s, p).some(a => actionsEqual(a, action)), `${tag}: bot chose illegal ${JSON.stringify(action)}`);
    const prevTotals = Object.fromEntries(Object.entries(s.scores).map(([id, x]) => [id, x.total]));
    const before = JSON.stringify(s);
    deepFreeze(s);
    const res = reduce(s, p, action, steps);
    assert(JSON.stringify(s) === before, `${tag}: reduce mutated its input state`);
    assert(res.ok, `${tag}: reduce rejected ${JSON.stringify(action)}: ${!res.ok && res.error.message}`);
    for (const e of res.events) {
      if (e.type === 'marriage') tally.marriage++;
      if (e.type === 'roundScored' || e.type === 'threw') {
        checkSummary(e.summary, prevTotals, tag);
        roundEnds.push(e.summary.number);
      }
    }
    assert(res.state.seq === s.seq + 1, `${tag}: seq did not advance`);
    log.push({ p, action });
    s = jsonRoundTrip ? (JSON.parse(JSON.stringify(res.state)) as GameState) : res.state;
    if (s.phase !== 'gameEnd') {
      const keys = roundCards(s).map(cardKey);
      assert(keys.length === 24 && new Set(keys).size === 24, `${tag}: card conservation broken (${keys.length})`);
    }
    const shadow = Object.values(s.scores).every(x => x.total === x.history.reduce((a, b) => a + b, 0));
    assert(shadow, `${tag}: totals differ from history`);
  }
  // exactly one round-ending event (threw | roundScored) per round, in order
  assert(
    roundEnds.length === s.rounds.length && roundEnds.every((n, i) => n === i + 1),
    `${seed}: round-ending events ${JSON.stringify(roundEnds)} != ${s.rounds.length} rounds`,
  );
  assert(s.winner, `${seed}: no winner`);
  assert(s.scores[s.winner].total >= 1000, `${seed}: winner below 1000`);
  return { state: s, log };
}

describe('simulation', () => {
  it(`plays ${GAMES_3P} three-player bot games`, () => {
    for (let i = 0; i < GAMES_3P; i++) playGame(`3p-${i}`, SEATS3, i % 3, i < FULL_VIEW_CHECK_GAMES);
  }, 600_000);

  it(`plays ${GAMES_4P} four-player bot games`, () => {
    for (let i = 0; i < GAMES_4P; i++) playGame(`4p-${i}`, SEATS4, i % 4, i < FULL_VIEW_CHECK_GAMES);
  }, 600_000);

  it('is deterministic and survives JSON round-trips', () => {
    for (const [seed, seats] of [['det-3', SEATS3], ['det-4', SEATS4]] as const) {
      const a = playGame(seed, seats, 1, false);
      const b = playGame(seed, seats, 1, false, true);
      expect(b.state).toStrictEqual(a.state);
      expect(b.log).toStrictEqual(a.log);
      // replaying the logged actions from scratch reproduces the final state
      let s = createGame({ seed, seats, maxPlayers: seats.length as 3 | 4, firstDealer: 1 });
      a.log.forEach(({ p, action }, i) => {
        const res = reduce(s, p, action, i + 1);
        if (!res.ok) throw new Error(res.error.message);
        s = res.state;
      });
      expect(s).toStrictEqual(a.state);
    }
  }, 120_000);

  it('emits exactly one of threw/roundScored per round, with a summary not aliasing state', () => {
    const seats = SEATS3;
    let s = createGame({ seed: 'ends-1', seats, maxPlayers: 3, firstDealer: 0 });
    const rand = makeRandom('ends-bots');
    const perRound = new Map<number, number>();
    let checked = 0;
    for (let i = 0; s.phase !== 'gameEnd' && i < MAX_STEPS; i++) {
      const p = turnOf(s)!;
      const res = reduce(s, p, botAction(viewFor(s, p), rand), i);
      if (!res.ok) throw new Error(res.error.message);
      for (const e of res.events) {
        if (e.type !== 'threw' && e.type !== 'roundScored') continue;
        perRound.set(e.summary.number, (perRound.get(e.summary.number) ?? 0) + 1);
        const stored = res.state.rounds.find(r => r.number === e.summary.number)!;
        expect(e.summary).toStrictEqual(stored);
        expect(e.summary).not.toBe(stored);
        const snapshot = JSON.stringify(res.state);
        e.summary.players[0].scoreChange += 12345;
        e.summary.number = -1;
        expect(JSON.stringify(res.state)).toBe(snapshot);
        checked++;
      }
      s = res.state;
    }
    expect(s.phase).toBe('gameEnd');
    expect(checked).toBe(s.rounds.length);
    expect(perRound.size).toBe(s.rounds.length);
    for (const n of perRound.values()) expect(n).toBe(1);
  });

  it('exercised every rare scoring branch (guards against vacuous checks)', () => {
    console.log('simulation tally', JSON.stringify(tally), FULL ? '(full)' : '(sample)');
    expect(tally.thrown100).toBeGreaterThan(0);
    expect(tally.thrownOver100).toBeGreaterThan(0);
    expect(tally.failed).toBeGreaterThan(0);
    expect(tally.made).toBeGreaterThan(0);
    expect(tally.barrel).toBeGreaterThan(0);
    expect(tally.sittingOutScored).toBeGreaterThan(0);
    expect(tally.marriage).toBeGreaterThan(0);
    expect(tally.wykladana).toBeGreaterThan(0);
  });
});
