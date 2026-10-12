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
import { msg, type EngineMsg } from './messages';

const err = (code: RuleErrorCode, m: EngineMsg): RuleError => ({ code, msg: m });
const fail = (error: RuleError): ReduceResult => ({ ok: false, error });

/**
 * Applies one action atomically. Pure and deterministic: same (state, playerId, action, now) → same result.
 * Rejects anything not in legalActions(state, playerId). Never throws on malformed input.
 * Every round ends with exactly ONE of the events `threw` (throw-in) or `roundScored` (played or
 * wykładana round); both carry the round `summary`.
 */
export function reduce(state: GameState, playerId: PlayerId, action: Action, now: number): ReduceResult {
  if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
    return fail(err('illegalAction', msg('reject.unknownAction')));
  }
  if (!state.seats.some(x => x.id === playerId)) return fail(err('notSeated', msg('reject.notSeated')));
  if (state.phase === 'gameEnd') return fail(err('gameOver', msg('reject.gameOver')));
  if (state.paused && action.type !== 'resume') return fail(err('paused', msg('reject.paused')));

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
      void _exhaustive;
      return fail(err('illegalAction', msg('reject.unhandled')));
    }
  }
  ctx.s.seq += 1;
  return { ok: true, state: ctx.s, events: ctx.events };
}

function rejectFor(s: GameState, p: PlayerId, action: Action): RuleError {
  if (action.type === 'resume') return err('illegalAction', msg('reject.notPaused'));
  if (action.type === 'pause') return err('illegalAction', msg('reject.cantPause'));
  if (action.type === 'ackTalon') return err('illegalAction', msg('reject.nothingToConfirm'));
  if (s.phase === 'talon') return err('notYourTurn', msg('reject.waitTalon'));
  const r = s.round;
  if (!r || turnOf(s) !== p) return err('notYourTurn', msg('reject.notYourTurn'));
  if (action.type === 'card' && s.phase === 'tricks') {
    const why = isCard(action.card) ? cardRuleMessage(r.hands[p], r.trick.cards, r.trump, action.card) : null;
    return err('illegalCard', why ?? msg('reject.cantPlayCard'));
  }
  if (action.type === 'bid' && s.phase === 'bidding') {
    const amount = typeof action.amount === 'number' ? action.amount : NaN;
    return err('badBid', validateBid(amount, r.bid.amount, r.hands[p]).reason ?? msg('reject.invalidBid'));
  }
  if (action.type === 'handout' && s.phase === 'handout') {
    return err('badHandout', msg('reject.badHandout'));
  }
  return err('illegalAction', msg('reject.notAllowed'));
}
