import {
  RULES, advise, botAction, cardEquals, createGame, makeRandom, marriagesInHand, reduce, actorsOf, viewFor,
  type Action, type Card, type PlayerId, type PlayerView, type RoundSummary, type Seat, type Suit,
} from '@tysiac/engine';
import { BOT_AVATAR, BOT_NAMES } from '../net/localRoom';

/** The learner's id inside the lesson room (local only; never sent to a server). */
export const LEARNER_ID: PlayerId = 'learner';
export const LESSON_SECRET = 'lesson-local-secret';
/** LocalRoom names its first two bots `bot-1`/`bot-2` and "Bot Basia"/"Bot Zenek". */
export const LESSON_BOT_IDS = ['bot-1', 'bot-2'] as const;
export const LESSON_FIRST_DEALER = 0;
/** Found with findSeed.test.ts; lesson.test.ts proves it still teaches every beat. */
export const LESSON_SEED = 'lesson-95';

export interface LessonEntry {
  seq: number;
  pid: PlayerId;
  action: Action;
}
export interface LessonMoments {
  marriage: Suit | null;
  learnerBid: boolean;
  bidWon: number | null;
  played: boolean;
  marriageLead: boolean;
  mustBeat: boolean;
  noSuit: boolean;
  wykladana: boolean;
}
export interface Lesson {
  seed: string;
  entries: LessonEntry[];
  summary: RoundSummary | null;
  moments: LessonMoments;
}

export function lessonSeats(name = 'You', avatar = '🙂'): Seat[] {
  return [
    { id: LEARNER_ID, name, avatar, isBot: false },
    { id: LESSON_BOT_IDS[0], name: BOT_NAMES[0], avatar: BOT_AVATAR, isBot: true },
    { id: LESSON_BOT_IDS[1], name: BOT_NAMES[1], avatar: BOT_AVATAR, isBot: true },
  ];
}

const legalCards = (v: PlayerView): Card[] => v.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
const myTricksTurn = (v: PlayerView): boolean => v.phase === 'tricks' && v.turn === v.me && !v.paused && v.round !== null;

/** On trick 1, the learner's lead of the Queen of an undeclared marriage (if legal), else null. */
export function marriageLead(v: PlayerView): Action | null {
  if (!myTricksTurn(v)) return null;
  const r = v.round!;
  if (r.trick.cards.length !== 0 || r.played.length !== 0) return null;
  const declared = r.marriages[v.me] ?? [];
  const suit = marriagesInHand(r.hand).find(s => !declared.includes(s));
  if (!suit) return null;
  const queen = legalCards(v).find(c => c.suit === suit && c.rank === 'Q');
  return queen ? { type: 'card', card: queen } : null;
}

/** First to answer, and the engine forbids some card of the led suit, so the must-beat rule is in force. */
export function mustBeatNow(v: PlayerView): boolean {
  if (!myTricksTurn(v) || v.round!.trick.cards.length !== 1) return false;
  const led = v.round!.trick.cards[0].card.suit;
  const legal = legalCards(v);
  return v.round!.hand.some(c => c.suit === led && !legal.some(l => cardEquals(l, c)));
}

/** The learner must answer a trick and holds no card of the led suit. */
export function cannotFollowNow(v: PlayerView): boolean {
  if (!myTricksTurn(v) || v.round!.trick.cards.length === 0) return false;
  const led = v.round!.trick.cards[0].card.suit;
  return !v.round!.hand.some(c => c.suit === led);
}

/**
 * Plays round 1 of the lesson game: bots use botAction (own seeded rng), the learner follows advise(),
 * except it leads the marriage Queen on trick 1. Stops at the round's `roundScored`/`threw`.
 */
export function buildLesson(seed: string): Lesson {
  let state = createGame({ seed: `${seed}:0`, seats: lessonSeats(), maxPlayers: 3, firstDealer: LESSON_FIRST_DEALER });
  const rng = makeRandom(`${seed}:lesson-bots`);
  const entries: LessonEntry[] = [];
  const dealt = viewFor(state, LEARNER_ID).round?.hand ?? [];
  const moments: LessonMoments = {
    marriage: marriagesInHand(dealt)[0] ?? null,
    learnerBid: false, bidWon: null, played: false, marriageLead: false, mustBeat: false, noSuit: false, wykladana: false,
  };
  let summary: RoundSummary | null = null;
  for (let guard = 0; guard < 300; guard++) {
    if (summary !== null) break;
    const pid = actorsOf(state)[0] ?? null;
    if (!pid) break;
    const view = viewFor(state, pid);
    let action: Action;
    if (pid === LEARNER_ID) {
      if (mustBeatNow(view)) moments.mustBeat = true;
      if (cannotFollowNow(view)) moments.noSuit = true;
      const lead = marriageLead(view);
      if (lead) moments.marriageLead = true;
      action = lead ?? advise(view)?.action ?? botAction(view, rng);
      if (action.type === 'bid') moments.learnerBid = true;
      if (action.type === 'play') moments.played = true;
    } else {
      action = botAction(view, rng);
    }
    const r = reduce(state, pid, action, 0);
    if (!r.ok) throw new Error(`lesson ${seed}: ${pid} ${JSON.stringify(action)} rejected: ${r.error.message}`);
    entries.push({ seq: state.seq, pid, action });
    for (const e of r.events) {
      if (e.type === 'wykladana') moments.wykladana = true;
      if (e.type === 'biddingWon' && e.p === LEARNER_ID) moments.bidWon = e.amount;
      if (e.type === 'roundScored' || e.type === 'threw') summary = e.summary;
    }
    state = r.state;
  }
  return { seed, entries, summary, moments };
}

/** Every beat the lesson promises (spec §9) that this seed fails to produce. Empty = usable seed. */
export function lessonProblems(l: Lesson): string[] {
  const m = l.moments;
  const out: string[] = [];
  if (!m.marriage) out.push('learner is dealt no marriage');
  if (!m.learnerBid) out.push('learner never bids');
  if (m.bidWon === null || m.bidWon <= RULES.autoBid) out.push('learner does not win the bidding above 100');
  if (!m.played) out.push('learner does not choose Play');
  if (m.wykladana) out.push('round ends as wykładana');
  if (!m.marriageLead) out.push('learner does not lead a marriage Queen on trick 1');
  if (!m.mustBeat) out.push('no must-beat moment for the learner');
  if (!m.noSuit) out.push('no cannot-follow moment for the learner');
  if (!l.summary || l.summary.bidder !== LEARNER_ID || l.summary.outcome !== 'made') out.push('learner does not make the bid');
  return out;
}

export function expectedAt(l: Lesson, seq: number): Action | null {
  const e = l.entries.find(x => x.seq === seq);
  return e && e.pid === LEARNER_ID ? e.action : null;
}

export function lessonBotMove(l: Lesson): (view: PlayerView, pid: PlayerId) => Action | null {
  return (view, pid) => {
    const e = l.entries.find(x => x.seq === view.seq);
    return e && e.pid === pid ? e.action : null;
  };
}
