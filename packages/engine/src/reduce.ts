import type { Action, GameState, PlayerId, ReduceResult, RuleError, RuleErrorCode } from './types';
import { actionsEqual, legalActions, turnOf } from './actions';
import { isCard } from './cards';
import { validateBid } from './bidding';
import { cardRuleMessage } from './tricks';
import { clone, emit, type Ctx } from './ctx';
import { applyBid, applyPass } from './phases/bidding';
import { applyAckTalon } from './phases/talon';
import { applyHandout } from './phases/handout';
import { applyCard } from './phases/tricks';
import { applyPlay, applyThrow } from './phases/decision';

const err = (code: RuleErrorCode, message: string): RuleError => ({ code, message });
const fail = (error: RuleError): ReduceResult => ({ ok: false, error });

/**
 * Applies one action atomically. Pure and deterministic: same (state, playerId, action, now) → same result.
 * Rejects anything not in legalActions(state, playerId). Never throws on malformed input.
 * Every round ends with exactly ONE of the events `threw` (throw-in) or `roundScored` (played or
 * wykładana round); both carry the round `summary`.
 */
export function reduce(state: GameState, playerId: PlayerId, action: Action, now: number): ReduceResult {
  if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
    return fail(err('illegalAction', 'Unknown action'));
  }
  if (!state.seats.some(x => x.id === playerId)) return fail(err('notSeated', "You're not seated in this game"));
  if (state.phase === 'gameEnd') return fail(err('gameOver', 'The game is over'));
  if (state.paused && action.type !== 'resume') return fail(err('paused', 'The game is paused'));

  const legal = legalActions(state, playerId).find(a => actionsEqual(a, action));
  if (!legal) return fail(rejectFor(state, playerId, action));

  const ctx: Ctx = { s: clone(state), events: [], now };
  switch (legal.type) {
    case 'bid':
      applyBid(ctx, playerId, legal.amount);
      break;
    case 'pass':
      applyPass(ctx, playerId);
      break;
    case 'play':
      applyPlay(ctx);
      break;
    case 'ackTalon':
      applyAckTalon(ctx, playerId);
      break;
    case 'throw':
      applyThrow(ctx, playerId);
      break;
    case 'pause':
      ctx.s.paused = { by: playerId, at: now };
      emit(ctx, { type: 'paused', p: playerId });
      break;
    case 'resume':
      ctx.s.paused = null;
      emit(ctx, { type: 'resumed', p: playerId });
      break;
    case 'handout':
      applyHandout(ctx, playerId, legal.to);
      break;
    case 'card':
      applyCard(ctx, playerId, legal.card);
      break;
    default: {
      const _exhaustive: never = legal;
      return fail(err('illegalAction', `Unhandled action: ${JSON.stringify(_exhaustive)}`));
    }
  }
  ctx.s.seq += 1;
  return { ok: true, state: ctx.s, events: ctx.events };
}

function rejectFor(s: GameState, p: PlayerId, action: Action): RuleError {
  if (action.type === 'resume') return err('illegalAction', "The game isn't paused");
  if (action.type === 'pause') return err('illegalAction', "You can't pause right now");
  if (action.type === 'ackTalon') return err('illegalAction', "There's nothing to confirm");
  if (s.phase === 'talon') return err('notYourTurn', 'Wait until everyone has seen the talon');
  const r = s.round;
  if (!r || turnOf(s) !== p) return err('notYourTurn', "It's not your turn");
  if (action.type === 'card' && s.phase === 'tricks') {
    const msg = isCard(action.card) ? cardRuleMessage(r.hands[p], r.trick.cards, r.trump, action.card) : null;
    return err('illegalCard', msg ?? "You can't play that card");
  }
  if (action.type === 'bid' && s.phase === 'bidding') {
    const amount = typeof action.amount === 'number' ? action.amount : NaN;
    return err('badBid', validateBid(amount, r.bid.amount, r.hands[p]).reason ?? 'Invalid bid');
  }
  if (action.type === 'handout' && s.phase === 'handout') {
    return err('badHandout', 'Give exactly one of your cards to each opponent');
  }
  return err('illegalAction', "That move isn't allowed right now");
}
