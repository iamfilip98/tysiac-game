import type { Card, PlayerId } from '../types';
import { marriagesInHand, removeCard } from '../cards';
import { detectWykladana, wykladanaTrump } from '../wykladana';
import { clone, emit, roundOf, seatIds, type Ctx } from '../ctx';
import { finishRound } from '../round';

export function applyHandout(ctx: Ctx, p: PlayerId, to: Record<PlayerId, Card>): void {
  const r = roundOf(ctx);
  let hand = r.hands[p];
  for (const [q, card] of Object.entries(to)) {
    hand = removeCard(hand, card);
    r.hands[q] = [...r.hands[q], { ...card }];
  }
  r.hands[p] = hand;
  r.handoutGiven = clone(to);
  const recipients = r.active.filter(q => q !== p);
  for (const id of seatIds(ctx.s)) {
    const cards: Partial<Record<PlayerId, Card>> = id === p ? clone(to) : to[id] ? { [id]: { ...to[id] } } : {};
    emit(ctx, { type: 'handedOut', p, recipients, cards }, [id]);
  }

  if (detectWykladana(hand)) {
    const marriages = marriagesInHand(hand);
    r.marriages[p] = marriages;
    r.trump = wykladanaTrump(hand);
    emit(ctx, { type: 'wykladana', p, hand: clone(hand), trump: r.trump, marriages: [...marriages] });
    finishRound(ctx, true);
    return;
  }

  ctx.s.phase = 'tricks';
  r.trick = { leader: p, cards: [] };
}
