import { botAction, botShouldAct, legalActions, turnOf, viewFor } from '@tysiac/engine';
import type { Action, GameState, PlayerId } from '@tysiac/engine';
import { isBotControlled } from './lobby';
import type { RoomMeta } from './types';

/**
 * The player a bot must move for right now, or null (paused, finished, a human's turn, or nothing
 * for the engine bot to do). `botAction` throws in those cases, so every bot move goes through here.
 */
export function botActor(state: GameState, meta: RoomMeta): PlayerId | null {
  if (state.paused !== null || state.winner !== null || state.phase === 'gameEnd') return null;
  const actor = turnOf(state);
  if (actor === null || !isBotControlled(meta, actor)) return null;
  return botShouldAct(viewFor(state, actor)) ? actor : null;
}

/** Engine bot on the actor's own view (no hidden info); falls back to the first legal move. */
export function chooseBotAction(state: GameState, actor: PlayerId, rand: () => number): Action {
  try {
    return botAction(viewFor(state, actor), rand);
  } catch (err) {
    const fallback = legalActions(state, actor).find((a) => a.type !== 'pause' && a.type !== 'resume');
    if (!fallback) throw err;
    return fallback;
  }
}
