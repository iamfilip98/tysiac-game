import type { Card, PlayerId } from './types';
import { RULES } from './rules';
import { createDeck, handPoints, marriagesInHand } from './cards';
import { shuffle } from './rng';

/** Round n's dealer: firstDealer for round 1, then the next seat clockwise each round. */
export function dealerIndexFor(firstDealer: number, roundNumber: number, seatCount: number): number {
  return (firstDealer + roundNumber - 1) % seatCount;
}

/** Players who play the round, clockwise from left of the dealer. 4 seats: the dealer sits out. */
export function activeFor(seatIds: PlayerId[], dealerIndex: number): PlayerId[] {
  const n = seatIds.length;
  const out: PlayerId[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = (dealerIndex + i) % n;
    if (n === 4 && idx === dealerIndex) continue;
    out.push(seatIds[idx]);
  }
  return out;
}

/** A hand is playable with >= 18 points or any marriage. */
export function isHandValid(hand: Card[]): boolean {
  return handPoints(hand) >= RULES.redealBelow || marriagesInHand(hand).length > 0;
}

export interface Deal {
  hands: Record<PlayerId, Card[]>;
  talon: Card[];
  rng: string;
  redeals: number;
}

/** Shuffle and deal 7 to each active player + 3 to the talon; reshuffle while any hand is invalid. */
export function dealCards(rng: string, active: PlayerId[]): Deal {
  let state = rng;
  let redeals = 0;
  for (;;) {
    const [deck, next] = shuffle(createDeck(), state);
    state = next;
    const hands: Record<PlayerId, Card[]> = {};
    for (const p of active) hands[p] = [];
    const dealt = RULES.handSize * active.length;
    for (let i = 0; i < dealt; i++) hands[active[i % active.length]].push(deck[i]);
    const talon = deck.slice(dealt, dealt + RULES.talonSize);
    if (active.every(p => isHandValid(hands[p]))) return { hands, talon, rng: state, redeals };
    redeals++;
  }
}
