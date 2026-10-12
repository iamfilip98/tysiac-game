import { explainEvent, type EngineMsg, type GameEvent, type PlayerId, type PlayerView } from '@tysiac/engine';
import { playerName } from '../i18n/engineText';

/** "You" (in the active language) for the viewer, otherwise the seat's name. */
export function who(view: PlayerView, p: PlayerId): string {
  return playerName(view, p);
}

/** A one-line note shown in the action zone while an event plays (rendered with engineText). */
export function eventNote(e: GameEvent, view: PlayerView, coach: boolean): EngineMsg | null {
  if (coach) {
    const text = explainEvent(e, view);
    if (text) return text;
  }
  // Marriage, wykladana and bidding-won are covered by the ticker (game/announce.ts).
  return null;
}
