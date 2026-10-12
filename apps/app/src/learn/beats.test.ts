import { describe, expect, it } from 'vitest';
import { RULES, createGame, reduce, viewFor, type GameState, type PlayerView } from '@tysiac/engine';
import { BEATS, describeExpected, lessonAdvice, lessonHint, nextBeat } from './beats';
import { lineText } from '../i18n/engineText';
import { LEARNER_ID, LESSON_FIRST_DEALER, LESSON_SEED, buildLesson, expectedAt, lessonSeats } from './lesson';

const lesson = buildLesson(LESSON_SEED);
const base = lesson.entries[0].seq;
/** Every learner view along the scripted round, plus the final view: views()[seq - base]. */
function views(): PlayerView[] {
  let s: GameState = createGame({ seed: `${LESSON_SEED}:0`, seats: lessonSeats('Ola', '🦊'), maxPlayers: 3, firstDealer: LESSON_FIRST_DEALER });
  const out = [viewFor(s, LEARNER_ID)];
  for (const e of lesson.entries) {
    const r = reduce(s, e.pid, e.action, 0);
    if (!r.ok) throw new Error(r.error.msg.key);
    s = r.state;
    out.push(viewFor(s, LEARNER_ID));
  }
  return out;
}

describe('beats', () => {
  it('every beat becomes ready at some point of the scripted round, exactly once', () => {
    const vs = views();
    const seen: string[] = [];
    for (const v of vs) {
      for (let b = nextBeat(v, seen); b; b = nextBeat(v, seen)) seen.push(b.id);
    }
    expect([...seen].sort()).toEqual(BEATS.map(b => b.id).sort());
    expect(seen.slice(0, 4)).toEqual(['welcome', 'cards', 'marriage', 'bidding']);
    expect(seen.slice(-2)).toEqual(['scoring', 'done']);
  });

  it('beat text uses engine RULES numbers', () => {
    const v = views()[0];
    const cards = BEATS.find(b => b.id === 'cards')!.body(v).join(' ');
    expect(cards).toContain(`A = ${RULES.cardPoints.A}`);
    expect(cards).toContain(`${RULES.pointsPerRound}`);
    const bidding = BEATS.find(b => b.id === 'bidding')!.body(v).join(' ');
    expect(bidding).toContain(`${v.round!.maxBid}`);
  });

  it('the scoring beat quotes the round summary', () => {
    const last = views().at(-1)!;
    const me = last.rounds[0].players.find(p => p.playerId === LEARNER_ID)!;
    const text = BEATS.find(b => b.id === 'scoring')!.body(last).join(' ');
    expect(text).toContain(`+${me.scoreChange}`);
    expect(text).toContain(`${RULES.barrelAt}`);
    expect(text).toContain(`${RULES.winAt}`);
  });

  it('lessonAdvice recommends exactly the scripted action on every learner turn', () => {
    const vs = views();
    for (const e of lesson.entries.filter(x => x.pid === LEARNER_ID)) {
      const v = vs[e.seq - base];
      const a = lessonAdvice(v, expectedAt(lesson, v.seq))!;
      expect(a.action).toEqual(e.action);
      expect(lineText(a.headline, v).length).toBeGreaterThan(0);
      expect(a.reasons.length).toBeGreaterThan(0);
    }
  });

  it('the hand-out headline skips cards the learner has already assigned', () => {
    const vs = views();
    const e = lesson.entries.find(x => x.pid === LEARNER_ID && x.action.type === 'handout');
    if (!e || e.action.type !== 'handout') throw new Error('lesson has no learner hand-out');
    const v = vs[e.seq - base];
    const [[p1, c1]] = Object.entries(e.action.to);
    const one = lessonAdvice(v, e.action, { handoutGiven: { [p1]: c1 } })!;
    expect(lineText(one.headline, v)).not.toContain(' and ');
    const all = lessonAdvice(v, e.action, { handoutGiven: e.action.to })!;
    expect(lineText(all.headline, v)).toMatch(/^Confirm: /);
  });

  it('the trick-1 lead is announced as a marriage declaration', () => {
    const vs = views();
    const lead = lesson.entries.find(e => e.pid === LEARNER_ID && e.action.type === 'card')!;
    expect(lineText(lessonAdvice(vs[lead.seq - base], lead.action)!.headline, vs[lead.seq - base])).toMatch(/^Lead Q. to declare your marriage$/);
  });

  it('lessonHint names the scripted move, and pausing is explained', () => {
    const vs = views();
    const bid = lesson.entries.find(e => e.pid === LEARNER_ID && e.action.type === 'bid')!;
    expect(lessonHint(vs[bid.seq - base], bid.action, { type: 'pass' })).toBe(`Lesson: Bid ${(bid.action as { amount: number }).amount}.`);
    expect(lessonHint(vs[bid.seq - base], bid.action, { type: 'pause' })).toBe('The lesson waits for you — no need to pause.');
    expect(lessonHint(null, null, { type: 'pass' })).toBe('Not yet — wait for your turn.');
  });

  it('describeExpected gives labels and names for the e2e hook', () => {
    const vs = views();
    const handout = lesson.entries.find(e => e.pid === LEARNER_ID && e.action.type === 'handout')!;
    const d = describeExpected(vs[handout.seq - base], handout.action);
    expect(d.type).toBe('handout');
    expect(d.give!.map(g => g.to).sort()).toEqual(['Bot Basia', 'Bot Zenek']);
    expect(d.give![0].card).toMatch(/^(9|10|J|Q|K|A)[♣♦♥♠]$/);
  });
});
