import type { Card, PlayerId } from '../types';
import { RULES } from '../rules';
import { handPoints, hasMarriage, removeCard } from '../cards';
import { getTrickWinnerWithReason } from '../tricks';
import { clone, emit, roundOf, type Ctx } from '../ctx';
import { finishRound } from '../round';

export function applyCard(ctx: Ctx, p: PlayerId, card: Card): void {
  const r = roundOf(ctx);
  const hand = r.hands[p];

  // Marriage: leading a Q while holding its K declares it; trump applies to this trick already.
  if (r.trick.cards.length === 0 && card.rank === 'Q' && hasMarriage(hand, card.suit) && !r.marriages[p].includes(card.suit)) {
    r.marriages[p].push(card.suit);
    r.trump = card.suit;
    emit(ctx, { type: 'marriage', p, suit: card.suit, points: RULES.marriageValues[card.suit] });
  }

  r.hands[p] = removeCard(hand, card);
  r.trick.cards.push({ p, card: { ...card } });
  emit(ctx, { type: 'cardPlayed', p, card: { ...card } });

  if (r.trick.cards.length < r.active.length) return;

  const won = getTrickWinnerWithReason(r.trick.cards, r.trump);
  const cards = r.trick.cards.map(t => t.card);
  const points = handPoints(cards);
  r.tricksWon[won.winnerId].push(cards);
  r.lastTrick = { cards: clone(r.trick.cards), winner: won.winnerId, points };
  emit(ctx, {
    type: 'trickWon',
    p: won.winnerId,
    cards: clone(r.trick.cards),
    card: { ...won.winningCard },
    points,
    byTrump: won.byTrump,
  });
  r.trick = { leader: won.winnerId, cards: [] };

  if (r.active.every(q => r.hands[q].length === 0)) finishRound(ctx, false);
}
