import {
  RULES, actionsEqual, advise, cardEquals, cardLabel, marriagesInHand, msg,
  type Action, type Card, type PlayerId, type PlayerView, type Rank, type Suit,
} from '@tysiac/engine';
import { SUIT_TEXT } from '../game/cards';
import { throwCost, throwCostLine } from '../game/panels';
import { appLine, lineText, type CoachAdvice, type Line } from '../i18n/engineText';
import { currentLang, t } from '../i18n';
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
const rank = (r: Rank): string => t(`card.rank.${r}`);
const myTurn = (v: PlayerView): boolean => v.turn === v.me && !v.paused;
const HIGH_FIRST = [...RULES.ranks].sort((a, b) => RULES.rankStrength[b] - RULES.rankStrength[a]) as Rank[];
const firstMarriage = (v: PlayerView): Suit | undefined => (v.round ? marriagesInHand(v.round.hand)[0] : undefined);
const bots = (v: PlayerView): string =>
  new Intl.ListFormat(currentLang(), { type: 'conjunction' }).format(v.seats.filter(s => s.id !== v.me).map(s => s.name));

/** Beat titles and bodies are rendered in the active language each time they are shown. */
export const BEATS: Beat[] = [
  {
    id: 'welcome',
    ready: v => v.phase === 'bidding',
    title: () => t('learn.welcome.title'),
    body: v => [t('learn.welcome.body.0', { bots: bots(v) }), t('learn.welcome.body.1')],
  },
  {
    id: 'cards',
    ready: v => v.phase === 'bidding',
    title: () => t('learn.cards.title'),
    body: () => [
      HIGH_FIRST.map(r => `${rank(r)} = ${RULES.cardPoints[r]}`).join(' · '),
      t('learn.cards.body.1', { order: HIGH_FIRST.map(rank).join(' > ') }),
      t('learn.cards.body.2', { total: RULES.pointsPerRound }),
    ],
  },
  {
    id: 'marriage',
    ready: v => v.phase === 'bidding' && firstMarriage(v) !== undefined,
    title: () => t('learn.marriage.title'),
    body: v => {
      const s = firstMarriage(v)!;
      return [
        t('learn.marriage.body.0', { values: RULES.marriageOrder.map(x => `${sym(x)} ${RULES.marriageValues[x]}`).join(' · ') }),
        t('learn.marriage.body.1', { king: `${rank('K')}${sym(s)}`, queen: `${rank('Q')}${sym(s)}`, suit: sym(s), points: RULES.marriageValues[s] }),
      ];
    },
  },
  {
    id: 'bidding',
    ready: v => v.phase === 'bidding',
    title: () => t('learn.bidding.title'),
    body: v => [
      t('learn.bidding.body.0', { player: nameOf(v, v.round!.bid.high), auto: RULES.autoBid, step: RULES.bidStep }),
      t('learn.bidding.body.1', { max: v.round!.maxBid, base: RULES.maxBidBase }),
    ],
  },
  {
    id: 'talon',
    ready: v => v.phase === 'decision' && myTurn(v),
    title: () => t('learn.talon.title'),
    body: v => [
      t('learn.talon.body.0', { amount: v.round!.bid.amount, count: RULES.talonSize }),
      v.round!.talonPublic ? t('learn.talon.body.public', { auto: RULES.autoBid }) : t('learn.talon.body.private', { auto: RULES.autoBid }),
      t('learn.talon.body.2', { cost: throwCost(v) }),
    ],
  },
  {
    id: 'handout',
    ready: v => v.phase === 'handout' && myTurn(v),
    title: () => t('learn.handout.title'),
    body: () => [t('learn.handout.body.0'), t('learn.handout.body.1'), t('learn.handout.body.2')],
  },
  {
    id: 'marriageLead',
    ready: v => marriageLead(v) !== null,
    title: () => t('learn.marriageLead.title'),
    body: v => {
      const card = (marriageLead(v) as Extract<Action, { type: 'card' }>).card;
      return [
        t('learn.marriageLead.body.0'),
        t('learn.marriageLead.body.1', { points: RULES.marriageValues[card.suit], suit: sym(card.suit) }),
      ];
    },
  },
  {
    id: 'trump',
    ready: v => v.phase === 'tricks' && v.round !== null && v.round.trump !== null && v.round.played.length >= 3,
    title: v => t('learn.trump.title', { suit: sym(v.round!.trump!) }),
    body: () => [t('learn.trump.body.0'), t('learn.trump.body.1'), t('learn.trump.body.2')],
  },
  {
    id: 'mustBeat',
    ready: v => mustBeatNow(v),
    title: () => t('learn.mustBeat.title'),
    body: () => [t('learn.mustBeat.body.0'), t('learn.mustBeat.body.1'), t('learn.mustBeat.body.2')],
  },
  {
    id: 'noSuit',
    ready: v => cannotFollowNow(v),
    title: () => t('learn.noSuit.title'),
    body: v => [t('learn.noSuit.body.0', { suit: sym(v.round!.trick.cards[0].card.suit) })],
  },
  {
    id: 'scoring',
    ready: v => v.rounds.length >= 1,
    title: () => t('learn.scoring.title'),
    body: v => {
      const s = v.rounds[0];
      const me = s.players.find(p => p.playerId === v.me)!;
      const raw = me.trickPoints + me.marriagePoints;
      return [
        t('learn.scoring.body.0', { bid: s.bid, tricks: me.trickPoints, marriage: me.marriagePoints, raw }),
        s.outcome === 'made'
          ? t('learn.scoring.body.made', { bid: s.bid, change: me.scoreChange, up: RULES.roundUpFrom })
          : t('learn.scoring.body.failed', { bid: s.bid }),
        t('learn.scoring.body.2'),
        t('learn.scoring.body.3', { barrel: RULES.barrelAt, win: RULES.winAt }),
      ];
    },
  },
  {
    id: 'done',
    final: true,
    ready: v => v.rounds.length >= 1,
    title: () => t('learn.done.title'),
    body: () => [t('learn.done.body.0')],
  },
];

export function nextBeat(v: PlayerView, seen: readonly string[]): Beat | null {
  return BEATS.find(b => !seen.includes(b.id) && b.ready(v)) ?? null;
}


/** The coach line during the lesson: the scripted move, explained (reasons from advise() when it agrees). */
export function lessonAdvice(
  v: PlayerView,
  expected: Action | null,
  opts: { handoutGiven?: Partial<Record<string, Card>> } = {},
): CoachAdvice | null {
  if (!expected || v.turn !== v.me || !v.round) return null;
  const coach = advise(v, opts);
  const theirs = coach && actionsEqual(coach.action, expected) ? coach.reasons : [];
  const why = (fallback: Line): Line[] => (theirs.length > 0 ? theirs : [fallback]);
  const plan = appLine('learn.advice.plan');
  switch (expected.type) {
    case 'bid':
      return {
        action: expected,
        headline: appLine('learn.advice.bid', { amount: expected.amount }),
        reasons: why(appLine('learn.advice.bidWhy', { max: v.round.maxBid })),
      };
    case 'pass':
      return { action: expected, headline: appLine('learn.advice.pass'), reasons: why(plan) };
    case 'play':
      return { action: expected, headline: appLine('learn.advice.play'), reasons: why(throwCostLine(v)) };
    case 'throw':
      return { action: expected, headline: appLine('learn.advice.throw'), reasons: why(throwCostLine(v)) };
    case 'handout': {
      // Cards the learner has already assigned as scripted are not named again.
      const entries = Object.entries(expected.to);
      const open = entries.filter(([p, c]) => !(opts.handoutGiven?.[p] && cardEquals(opts.handoutGiven[p]!, c)));
      const [a, b] = (open.length > 0 ? open : entries).map(([p, c]) => ({ card: { card: c }, player: { player: p } }));
      const headline =
        open.length === 0
          ? msg('coach.handout.confirmNeutral', { card1: a.card, player1: a.player, card2: b.card, player2: b.player })
          : b
            ? msg('coach.handout.two', { card1: a.card, player1: a.player, card2: b.card, player2: b.player })
            : msg('coach.handout.one', a);
      return { action: expected, headline, reasons: why(plan) };
    }
    case 'card': {
      const lead = marriageLead(v);
      const card = { card: expected.card };
      if (lead && actionsEqual(lead, expected)) {
        return {
          action: expected,
          headline: appLine('learn.advice.declare', { card }),
          reasons: [appLine('learn.advice.declareWhy', { points: RULES.marriageValues[expected.card.suit], suit: { suit: expected.card.suit } })],
        };
      }
      return { action: expected, headline: msg('coach.play', { card }), reasons: why(plan) };
    }
    default:
      return null;
  }
}

/** The toast when the learner tries something off-script: the scripted move, in the active language. */
export function lessonHint(v: PlayerView | null, expected: Action | null, tried: Action): string {
  if (tried.type === 'pause' || tried.type === 'resume') return t('learn.hint.noPause');
  if (!v || !expected) return t('learn.hint.wait');
  const a = lessonAdvice(v, expected);
  return a ? t('learn.hint.lesson', { text: lineText(a.headline, v) }) : t('learn.hint.wait');
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
