import { describe, expect, it } from 'vitest';
import { createGame, reduce } from '@tysiac/engine';
import {
  LEARNER_ID, LESSON_BOT_IDS, LESSON_FIRST_DEALER, LESSON_SEED,
  buildLesson, expectedAt, lessonBotMove, lessonProblems, lessonSeats,
} from './lesson';
import { BOT_NAMES } from '../net/localRoom';

const lesson = buildLesson(LESSON_SEED);

describe('lesson script', () => {
  it('LESSON_SEED still teaches every beat (if this fails, re-run: GEN_LESSON=1 pnpm --filter @tysiac/app exec vitest run src/learn/findSeed.test.ts)', () => {
    expect(lessonProblems(lesson)).toEqual([]);
  });

  it('ends after exactly one round that the learner bid and made', () => {
    expect(lesson.summary).not.toBeNull();
    expect(lesson.summary!.bidder).toBe(LEARNER_ID);
    expect(lesson.summary!.outcome).toBe('made');
    expect(lesson.summary!.bid).toBeGreaterThan(100);
  });

  it('is deterministic', () => {
    expect(buildLesson(LESSON_SEED)).toEqual(lesson);
  });

  it('entries have consecutive seqs (one engine action each)', () => {
    const base = lesson.entries[0].seq;
    expect(lesson.entries.map(e => e.seq - base)).toEqual(lesson.entries.map((_, i) => i));
  });

  it('expectedAt returns only the learner moves', () => {
    for (const e of lesson.entries) expect(expectedAt(lesson, e.seq)).toEqual(e.pid === LEARNER_ID ? e.action : null);
    expect(expectedAt(lesson, 9999)).toBeNull();
  });

  it("lessonBotMove returns a bot's scripted move only for that bot at that seq", () => {
    const move = lessonBotMove(lesson);
    const botEntry = lesson.entries.find(e => e.pid !== LEARNER_ID)!;
    const other = LESSON_BOT_IDS.find(id => id !== botEntry.pid)!;
    const view = { seq: botEntry.seq } as Parameters<typeof move>[0];
    expect(move(view, botEntry.pid)).toEqual(botEntry.action);
    expect(move(view, other)).toBeNull();
    expect(move({ seq: 9999 } as Parameters<typeof move>[0], botEntry.pid)).toBeNull();
  });

  it('bot seats match the names and ids LocalRoom gives the first two bots', () => {
    const seats = lessonSeats();
    expect(seats.map(s => s.id)).toEqual([LEARNER_ID, 'bot-1', 'bot-2']);
    expect(seats.slice(1).map(s => s.name)).toEqual([BOT_NAMES[0], BOT_NAMES[1]]);
  });

  it("the transcript does not depend on the learner's name or avatar", () => {
    let s = createGame({ seed: `${LESSON_SEED}:0`, seats: lessonSeats('Ola', '🦊'), maxPlayers: 3, firstDealer: LESSON_FIRST_DEALER });
    for (const e of lesson.entries) {
      expect(s.seq).toBe(e.seq);
      const r = reduce(s, e.pid, e.action, 0);
      expect(r.ok, JSON.stringify(e)).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(s.rounds[0]).toEqual(lesson.summary);
  });

  it('lessonProblems names every missing beat for a bad seed', () => {
    const bad = { ...lesson, moments: { ...lesson.moments, mustBeat: false, noSuit: false }, summary: null };
    expect(lessonProblems(bad)).toEqual([
      'no must-beat moment for the learner',
      'no cannot-follow moment for the learner',
      'learner does not make the bid',
    ]);
  });
});
