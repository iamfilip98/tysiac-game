import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@tysiac/engine';
import { LocalHub } from '../net/localService';
import { PROTOCOL_VERSION, type ServerMessage } from '../net/protocol';
import { FakeClock } from '../test/fakes';
import { Gate, gatedClock } from './gate';
import { LEARNER_ID, LESSON_SECRET, LESSON_SEED, buildLesson, expectedAt, lessonBotMove } from './lesson';

function start(clock: FakeClock, gate = new Gate()) {
  const lesson = buildLesson(LESSON_SEED);
  const hub = new LocalHub({ clock: gatedClock(gate, clock) });
  const code = hub.create({ maxPlayers: 3, playerId: LEARNER_ID, name: 'Ola', avatar: '🦊' }, { seed: LESSON_SEED, botMove: lessonBotMove(lesson) });
  const got: ServerMessage[] = [];
  const sock = hub.get(code)!.open(m => got.push(m));
  sock.send({ t: 'hello', v: PROTOCOL_VERSION, playerId: LEARNER_ID, secret: LESSON_SECRET, name: 'Ola', avatar: '🦊', coach: false });
  sock.send({ t: 'lobby', op: { op: 'addBot' } });
  sock.send({ t: 'lobby', op: { op: 'addBot' } });
  sock.send({ t: 'lobby', op: { op: 'start' } });
  const view = (): PlayerView => [...got].reverse().find((m): m is Extract<ServerMessage, { t: 'state' }> => m.t === 'state')!.view;
  return { lesson, sock, got, view, gate, hub, code };
}

describe('lesson round in a LocalRoom', () => {
  it('plays out exactly as scripted when the learner follows expectedAt', () => {
    const clock = new FakeClock();
    const { lesson, sock, got, view } = start(clock);
    let n = 0;
    for (let guard = 0; guard < 1000 && view().rounds.length === 0; guard++) {
      const v = view();
      const exp = expectedAt(lesson, v.seq);
      if (exp && v.turn === LEARNER_ID) sock.send({ t: 'act', id: `a${++n}`, action: exp });
      else clock.advance(5_000);
    }
    expect(got.filter(m => m.t === 'reject')).toEqual([]);
    expect(view().rounds[0]).toEqual(lesson.summary);
  });

  it('a closed gate holds bot moves until it opens', () => {
    const clock = new FakeClock();
    const gate = new Gate();
    gate.set(false);
    const { view, lesson } = start(clock, gate);
    const seq = view().seq;
    const firstIsBot = lesson.entries[0].pid !== LEARNER_ID;
    clock.advance(60_000);
    expect(view().seq).toBe(seq);
    gate.set(true);
    clock.advance(5_000);
    if (firstIsBot) expect(view().seq).toBeGreaterThan(seq);
  });

  it('after the scripted round, scripted bots stop instead of improvising', () => {
    const clock = new FakeClock();
    const { lesson, sock, view } = start(clock);
    let n = 0;
    for (let guard = 0; guard < 1000 && view().rounds.length === 0; guard++) {
      const v = view();
      const exp = expectedAt(lesson, v.seq);
      if (exp && v.turn === LEARNER_ID) sock.send({ t: 'act', id: `a${++n}`, action: exp });
      else clock.advance(5_000);
    }
    const seq = view().seq;
    clock.advance(120_000);
    expect(view().seq).toBe(seq);
  });
});
