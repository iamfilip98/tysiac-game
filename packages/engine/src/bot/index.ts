import type { Action, Card, PlayerId, PlayerView } from '../types';
import { actionsEqual } from '../actions';
import { decideBid, decideHandout, decidePlayOrThrow } from './eval';
import { chooseCard } from './play';
import type { BotChoice } from './reasons';

export type { BotChoice, Reason } from './reasons';

/**
 * True exactly when `botAction(view, ...)` is safe to call: it is this player's turn, the game is not
 * paused, the phase isn't `gameEnd`, and `view.legal` has a non-pause action.
 */
export function botShouldAct(view: PlayerView): boolean {
  if (view.phase === 'gameEnd' || view.paused) return false;
  return view.legal.some(a => a.type !== 'pause' && a.type !== 'resume');
}

/**
 * Bot move from the bot's own view only. `rng` is used only as a fallback tie-breaker.
 * @throws Error when the viewer has nothing to do (not its turn, game paused, or `gameEnd`).
 *   Guard calls with `botShouldAct(view)`.
 */
export function botAction(view: PlayerView, rng: () => number): Action {
  const options = view.legal.filter(a => a.type !== 'pause' && a.type !== 'resume');
  if (options.length === 0) throw new Error(`botAction: ${view.me} has nothing to do`);
  const chosen = botChoice(view)?.action;
  if (chosen && options.some(a => actionsEqual(a, chosen))) return chosen;
  return options[Math.floor(rng() * options.length)];
}

export interface BotChoiceOptions {
  /** Hand-out cards the player has already assigned; the choice then covers only the rest. */
  handoutGiven?: Partial<Record<PlayerId, Card>>;
}

/**
 * The bot's move for the viewer plus the reason (with the numbers) it was chosen; the coach explains
 * exactly this. Null when there is no decision to make or the phase has no strategy (the caller picks).
 */
export function botChoice(view: PlayerView, opts: BotChoiceOptions = {}): BotChoice | null {
  const r = view.round;
  if (!r || view.turn !== view.me) return null;
  const hand = r.hand;
  switch (view.phase) {
    case 'bidding':
      return decideBid(hand, r.bid.amount, r.bid.passed.length);
    case 'decision':
      return decidePlayOrThrow(hand, r.bid.amount);
    case 'handout': {
      const recipients = r.active.filter(p => p !== view.me);
      const totals = Object.fromEntries(recipients.map(p => [p, view.scores[p]?.total ?? 0]));
      return decideHandout(hand, recipients, totals, opts.handoutGiven);
    }
    case 'tricks': {
      const valid = view.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
      if (valid.length === 0) return null;
      const { card, reason } = chooseCard({
        valid,
        trick: r.trick.cards,
        trump: r.trump,
        isBidder: view.me === r.bid.high,
        bidder: r.bid.high,
        hand,
        played: r.played,
        declared: r.marriages[view.me] ?? [],
      });
      return { action: { type: 'card', card }, reason };
    }
    default:
      return null;
  }
}
