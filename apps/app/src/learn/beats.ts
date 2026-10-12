import {
  RULES, actionsEqual, advise, cardEquals, cardLabel, marriagesInHand,
  type Action, type Advice, type Card, type PlayerId, type PlayerView, type Rank, type Suit,
} from '@tysiac/engine';
import { SUIT_TEXT } from '../game/cards';
import { throwCost } from '../game/panels';
import { cannotFollowNow, marriageLead, mustBeatNow } from './lesson';

export interface Beat {
  id: string;
  /** The last beat: Learn shows "Practice with coach" / "Home" instead of Next. */
  final?: boolean;
  ready(v: PlayerView): boolean;
  title(v: PlayerView): string;
  body(v: PlayerView): string[];
}

const nameOf = (v: PlayerView, id: PlayerId): string => v.seats.find(s => s.id === id)?.name ?? id;
const sym = (s: Suit): string => SUIT_TEXT[s];
const myTurn = (v: PlayerView): boolean => v.turn === v.me && !v.paused;
const HIGH_FIRST = [...RULES.ranks].sort((a, b) => RULES.rankStrength[b] - RULES.rankStrength[a]) as Rank[];
const firstMarriage = (v: PlayerView): Suit | undefined => (v.round ? marriagesInHand(v.round.hand)[0] : undefined);
const bots = (v: PlayerView): string => v.seats.filter(s => s.id !== v.me).map(s => s.name).join(' and ');

export const BEATS: Beat[] = [
  {
    id: 'welcome',
    ready: v => v.phase === 'bidding',
    title: () => 'Welcome to Tysiąc',
    body: v => [
      `You'll play one round against ${bots(v)}, step by step.`,
      `When it's your move, the Coach line above your cards says what to do. Tap a card to raise it, then press Play.`,
    ],
  },
  {
    id: 'cards',
    ready: v => v.phase === 'bidding',
    title: () => 'Card values',
    body: () => [
      HIGH_FIRST.map(r => `${r} = ${RULES.cardPoints[r]}`).join(' · '),
      `Strongest to weakest: ${HIGH_FIRST.join(' > ')}.`,
      `All the cards together are worth ${RULES.pointsPerRound} points each round.`,
    ],
  },
  {
    id: 'marriage',
    ready: v => v.phase === 'bidding' && firstMarriage(v) !== undefined,
    title: () => 'Marriages',
    body: v => {
      const s = firstMarriage(v)!;
      return [
        `A King and Queen of one suit are a marriage: ${RULES.marriageOrder.map(x => `${sym(x)} ${RULES.marriageValues[x]}`).join(' · ')}.`,
        `You hold K${sym(s)} and Q${sym(s)} — the ${sym(s)} marriage, worth ${RULES.marriageValues[s]}. You'll declare it during play.`,
      ];
    },
  },
  {
    id: 'bidding',
    ready: v => v.phase === 'bidding',
    title: () => 'Bidding',
    body: v => [
      `${nameOf(v, v.round!.bid.high)} has to open at ${RULES.autoBid}. After that, each player bids ${RULES.bidStep} more or passes.`,
      `The highest bidder must score at least that many points this round. You can bid up to ${v.round!.maxBid}: ${RULES.maxBidBase} plus your marriages.`,
    ],
  },
  {
    id: 'talon',
    ready: v => v.phase === 'decision' && myTurn(v),
    title: () => 'You won the bidding',
    body: v => [
      `You won at ${v.round!.bid.amount}. The ${RULES.talonSize} talon cards are now in your hand.`,
      v.round!.talonPublic
        ? `Because the bid is over ${RULES.autoBid}, everyone saw the talon.`
        : `At ${RULES.autoBid} only you see the talon.`,
      `Now decide: play the hand, or throw in. ${throwCost(v)}`,
    ],
  },
  {
    id: 'handout',
    ready: v => v.phase === 'handout' && myTurn(v),
    title: () => 'Hand-out',
    body: () => [
      'Give one card to each opponent so everyone holds 8.',
      'Tap a card, then tap the player it goes to. Give away cards you need least — never half of your marriage.',
      'Then press Confirm hand-out.',
    ],
  },
  {
    id: 'marriageLead',
    ready: v => marriageLead(v) !== null,
    title: () => 'Declare your marriage',
    body: v => {
      const card = (marriageLead(v) as Extract<Action, { type: 'card' }>).card;
      return [
        'You lead the first trick. Leading the Queen while you hold the King declares the marriage.',
        `You score +${RULES.marriageValues[card.suit]} and ${sym(card.suit)} becomes trump at once.`,
      ];
    },
  },
  {
    id: 'trump',
    ready: v => v.phase === 'tricks' && v.round !== null && v.round.trump !== null && v.round.played.length >= 3,
    title: v => `${sym(v.round!.trump!)} is trump`,
    body: () => [
      'A trump beats every card of the other suits.',
      'A trick goes to the highest trump, or if there is none, to the highest card of the suit that was led.',
      'Marriage points only count if you win at least one trick.',
    ],
  },
  {
    id: 'mustBeat',
    ready: v => mustBeatNow(v),
    title: () => 'Follow suit — and beat it',
    body: () => [
      'You must play the suit that was led if you have it.',
      "As the first to answer, you must also beat the card if you can. Dimmed cards aren't allowed — tap one to see why.",
      'The last player only has to follow suit.',
    ],
  },
  {
    id: 'noSuit',
    ready: v => cannotFollowNow(v),
    title: () => 'No card of that suit',
    body: v => [
      `You have no ${sym(v.round!.trick.cards[0].card.suit)}, so you may play any card. You don't have to play trump.`,
    ],
  },
  {
    id: 'scoring',
    ready: v => v.rounds.length >= 1,
    title: () => 'Scoring',
    body: v => {
      const s = v.rounds[0];
      const me = s.players.find(p => p.playerId === v.me)!;
      const raw = me.trickPoints + me.marriagePoints;
      return [
        `You bid ${s.bid}. You took ${me.trickPoints} in tricks plus ${me.marriagePoints} for the marriage: ${raw}.`,
        s.outcome === 'made'
          ? `That reaches ${s.bid}, so you score +${me.scoreChange} (rounded to tens; ${RULES.roundUpFrom} and up rounds up). Falling short would have cost you ${s.bid}.`
          : `That is short of ${s.bid}, so you lose ${s.bid}.`,
        'Your opponents score the points from the tricks they took, plus any marriages they declared.',
        `From ${RULES.barrelAt} you are "on the barrel" and only score as the bidder. The first to ${RULES.winAt} wins the game.`,
      ];
    },
  },
  {
    id: 'done',
    final: true,
    ready: v => v.rounds.length >= 1,
    title: () => 'You know the basics',
    body: () => ['Next: a real practice game against two bots, with the coach switched on.'],
  },
];

export function nextBeat(v: PlayerView, seen: readonly string[]): Beat | null {
  return BEATS.find(b => !seen.includes(b.id) && b.ready(v)) ?? null;
}

const PLAN = "That's the plan for this hand — later the coach will help you choose.";

/** The coach line during the lesson: the scripted move, explained (reasons from advise() when it agrees). */
export function lessonAdvice(
  v: PlayerView,
  expected: Action | null,
  opts: { handoutGiven?: Partial<Record<string, Card>> } = {},
): Advice | null {
  if (!expected || v.turn !== v.me || !v.round) return null;
  const coach = advise(v, opts);
  const theirs = coach && actionsEqual(coach.action, expected) ? coach.reasons : [];
  const why = (fallback: string): string[] => (theirs.length > 0 ? theirs : [fallback]);
  switch (expected.type) {
    case 'bid':
      return { action: expected, headline: `Bid ${expected.amount}`, reasons: why(`Your marriage lets you bid up to ${v.round.maxBid}.`) };
    case 'pass':
      return { action: expected, headline: 'Pass', reasons: why(PLAN) };
    case 'play':
      return { action: expected, headline: 'Play the hand', reasons: why(throwCost(v)) };
    case 'throw':
      return { action: expected, headline: 'Throw in', reasons: why(throwCost(v)) };
    case 'handout': {
      // Cards the learner has already assigned as scripted are not named again.
      const entries = Object.entries(expected.to);
      const open = entries.filter(([p, c]) => !(opts.handoutGiven?.[p] && cardEquals(opts.handoutGiven[p]!, c)));
      const parts = (open.length > 0 ? open : entries).map(([p, c]) => `${cardLabel(c)} to ${nameOf(v, p)}`);
      return { action: expected, headline: `${open.length > 0 ? 'Give' : 'Confirm:'} ${parts.join(' and ')}`, reasons: why(PLAN) };
    }
    case 'card': {
      const lead = marriageLead(v);
      if (lead && actionsEqual(lead, expected)) {
        return {
          action: expected,
          headline: `Lead ${cardLabel(expected.card)} to declare your marriage`,
          reasons: [`+${RULES.marriageValues[expected.card.suit]} for you, and ${sym(expected.card.suit)} becomes trump.`],
        };
      }
      return { action: expected, headline: `Play ${cardLabel(expected.card)}`, reasons: why(PLAN) };
    }
    default:
      return null;
  }
}

export function lessonHint(v: PlayerView | null, expected: Action | null, tried: Action): string {
  if (tried.type === 'pause' || tried.type === 'resume') return 'The lesson waits for you — no need to pause.';
  if (!v || !expected) return 'Not yet — wait for your turn.';
  const a = lessonAdvice(v, expected);
  return a ? `Lesson: ${a.headline}.` : 'Not yet — wait for your turn.';
}

export interface ExpectedHint {
  type: Action['type'];
  amount?: number;
  card?: string;
  give?: { card: string; to: string }[];
}

export function describeExpected(v: PlayerView, a: Action): ExpectedHint {
  switch (a.type) {
    case 'bid':
      return { type: 'bid', amount: a.amount };
    case 'card':
      return { type: 'card', card: cardLabel(a.card) };
    case 'handout':
      return { type: 'handout', give: Object.entries(a.to).map(([p, c]) => ({ card: cardLabel(c), to: nameOf(v, p) })) };
    default:
      return { type: a.type };
  }
}
