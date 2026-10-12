import { describe, it, expect } from 'vitest';
import { actionsEqual, actorsOf, createGame, legalActions, reduce, talonWaiting, turnOf } from '@tysiac/engine';
import type { GameState, Seat } from '@tysiac/engine';
import { botActor, chooseBotAction } from '../src/room/bots';
import type { RoomMeta } from '../src/room/types';
import { setupTable } from './client';
import { debugDump, sleep } from './helpers';

const SEATS: Seat[] = [
  { id: 'a', name: 'Ala', avatar: '🦊', isBot: false },
  { id: 'b', name: 'Bartek', avatar: '🐻', isBot: false },
  { id: 'c', name: 'Celina', avatar: '🦉', isBot: false },
];

function metaFor(state: GameState, bots: string[], botFor: string[] = []): RoomMeta {
  return {
    code: 'ABCDEF', maxPlayers: 3, hostId: 'a', status: 'playing', createdAt: 0, firstDealer: 0, gameId: 'g', startedAt: 0,
    seats: state.seats.map((s) => ({
      id: s.id, name: s.name, avatar: s.avatar, isBot: bots.includes(s.id), secretHash: null,
      awaySince: null, botFor: botFor.includes(s.id), coach: false,
    })),
  };
}

describe('botActor / chooseBotAction', () => {
  const state = createGame({ seed: 'bots-unit', seats: SEATS, maxPlayers: 3, firstDealer: 0 });
  const actor = turnOf(state)!;

  it('returns the player to act only when a bot (or bot-for) controls that seat', () => {
    expect(botActor(state, metaFor(state, [actor]))).toBe(actor);
    expect(botActor(state, metaFor(state, [], [actor]))).toBe(actor);
    expect(botActor(state, metaFor(state, []))).toBeNull();
    expect(botActor(state, metaFor(state, SEATS.map((s) => s.id).filter((id) => id !== actor)))).toBeNull();
  });

  it('never acts while paused or after the game', () => {
    const meta = metaFor(state, [actor]);
    expect(botActor({ ...state, paused: { by: 'a', at: 1 } }, meta)).toBeNull();
    expect(botActor({ ...state, winner: 'a', phase: 'gameEnd' }, meta)).toBeNull();
  });

  it('chooses a legal, non-pause action', () => {
    const action = chooseBotAction(state, actor, () => 0.5);
    expect(action.type).not.toBe('pause');
    expect(legalActions(state, actor).some((a) => actionsEqual(a, action))).toBe(true);
  });
});

describe('bots in a room', () => {
  it('play their turns via the alarm until a round has been scored', async () => {
    const { host } = await setupTable({ humans: ['Ala'], bots: 2 });
    host.autoplay = true;
    host.playIfMyTurn();
    const s = await host.next('state', (m) => m.view.rounds.length >= 1, 30_000);
    expect(s.view.rounds[0].players).toHaveLength(3);
    host.autoplay = false;
  });

  it('do not move while the game is paused, and continue after resume', async () => {
    const { code, host } = await setupTable({ humans: ['Ala'], bots: 2 });
    host.act({ type: 'pause' });
    const paused = await host.next('state', (m) => m.view.paused !== null);
    await sleep(300);
    const dump = await debugDump(code);
    expect(dump.state?.seq).toBe(paused.seq);
    expect(dump.schedule.bot).toBeNull();

    host.autoplay = true;
    host.act({ type: 'resume' });
    await host.next('state', (m) => m.seq >= paused.seq + 4, 10_000);
    host.autoplay = false;
  });
});

function talonState(): GameState {
  for (let i = 0; i < 50; i++) {
    let s = createGame({ seed: `talon-${i}`, seats: SEATS, maxPlayers: 3, firstDealer: 0 });
    for (let n = 0; n < 400 && s.phase !== 'gameEnd'; n++) {
      if (s.phase === 'talon') return s;
      const p = actorsOf(s)[0]!;
      const r = reduce(s, p, chooseBotAction(s, p, () => 0.5), n);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
    }
  }
  throw new Error('no talon phase reached');
}

describe('botActor in the talon phase', () => {
  const s = talonState();
  const [w1, w2] = talonWaiting(s);
  const bidder = s.round!.bid.high;

  it('picks the first bot-controlled watcher', () => {
    expect(botActor(s, metaFor(s, [w1, w2]))).toBe(w1);
    expect(botActor(s, metaFor(s, [w2]))).toBe(w2);
  });
  it('waits for human watchers, and a bot-for seat covers an away human', () => {
    expect(botActor(s, metaFor(s, []))).toBeNull();
    expect(botActor(s, metaFor(s, [], [w1]))).toBe(w1);
  });
  it('the bidder has nothing to do, and nobody acts while paused', () => {
    expect(botActor(s, metaFor(s, [bidder]))).toBeNull();
    expect(botActor({ ...s, paused: { by: bidder, at: 1 } }, metaFor(s, [w1, w2]))).toBeNull();
  });
  it('a bot confirmation is a legal ackTalon', () => {
    expect(chooseBotAction(s, w1, () => 0.5)).toEqual({ type: 'ackTalon' });
  });
});

it('a room with bots gets through a public talon to the decision', async () => {
  const { host } = await setupTable({ humans: ['Ala'], bots: 2 });
  host.autoplay = true;
  host.playIfMyTurn();
  await host.next('state', (m) => m.events.some((e) => e.type === 'talonSeen'), 60_000);
  const s = await host.next('state', (m) => m.view.phase === 'decision' || m.view.phase === 'handout' || m.view.phase === 'tricks', 30_000);
  expect(s.view.round!.talonWaiting).toEqual([]);
  host.autoplay = false;
});
