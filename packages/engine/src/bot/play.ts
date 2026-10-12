import type { Card, PlayerId, Suit, TrickCard } from '../types';
import type { CardReason } from './reasons';
import { RANKS, RULES, SUITS } from '../rules';
import { cardEquals, handPoints, hasMarriage } from '../cards';
import { cardValue } from './eval';

const PTS = RULES.cardPoints;
const STR = RULES.rankStrength;

export function lowestValue(cards: Card[]): Card {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b))[0];
}

export function highestValue(cards: Card[]): Card {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a))[0];
}

function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();
  for (const card of cards) {
    const group = groups.get(card.suit) ?? [];
    group.push(card);
    groups.set(card.suit, group);
  }
  return groups;
}

/** The original AI's beat test: unlike the rules' canBeat, a lead-suit card beats an off-suit non-trump. */
function aiCanBeat(card: Card, toBeat: Card, leadSuit: Suit, trump: Suit | null): boolean {
  if (trump) {
    if (card.suit === trump && toBeat.suit !== trump) return true;
    if (card.suit !== trump && toBeat.suit === trump) return false;
    if (card.suit === trump && toBeat.suit === trump) return STR[card.rank] > STR[toBeat.rank];
  }
  if (card.suit === toBeat.suit) return STR[card.rank] > STR[toBeat.rank];
  if (card.suit === leadSuit && toBeat.suit !== leadSuit) return true;
  return false;
}

function currentWinner(cards: Card[], leadSuit: Suit, trump: Suit | null): Card {
  let winner = cards[0];
  for (let i = 1; i < cards.length; i++) if (aiCanBeat(cards[i], winner, leadSuit, trump)) winner = cards[i];
  return winner;
}

/** Cards neither in our hand nor played yet — still held by opponents (or unseen). */
export function remainingCards(hand: Card[], played: Card[]): Card[] {
  const out: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const card = { suit, rank };
      if (!played.some(p => cardEquals(p, card)) && !hand.some(h => cardEquals(h, card))) out.push(card);
    }
  }
  return out;
}

function pickSuitWithMostPoints(aces: Card[], remaining: Card[]): Card {
  if (aces.length === 1) return aces[0];
  let best = aces[0];
  let bestPoints = 0;
  for (const ace of aces) {
    const suitPoints = remaining.filter(c => c.suit === ace.suit).reduce((sum, c) => sum + PTS[c.rank], 0);
    if (suitPoints > bestPoints) {
      bestPoints = suitPoints;
      best = ace;
    }
  }
  return best;
}

/** Least valuable card to throw away; keeps aces, protected 10s, trumps and marriage pairs. */
export function lowestExpendable(cards: Card[], trump: Suit | null): Card {
  const scored = cards.map(card => {
    let keep = cardValue(card);
    if (card.rank === 'A') keep += 30;
    if (card.rank === '10') keep += cards.some(c => c.suit === card.suit && c.rank === 'A') ? 20 : 5;
    if (trump && card.suit === trump) keep += 10;
    if (
      (card.rank === 'Q' || card.rank === 'K') &&
      cards.some(c => c.suit === card.suit && c.rank === (card.rank === 'Q' ? 'K' : 'Q'))
    ) {
      keep += 15;
    }
    return { card, keep };
  });
  scored.sort((a, b) => a.keep - b.keep);
  return scored[0].card;
}

/** Highest-value marriage in hand that has not been declared yet. */
export function marriageToDeclare(hand: Card[], declared: Suit[]): Suit | null {
  return RULES.marriageOrder.find(suit => hasMarriage(hand, suit) && !declared.includes(suit)) ?? null;
}

/** True for the K or Q of a held marriage that has not been declared yet. */
export function isMarriageCard(card: Card, hand: Card[], declared: Suit[]): boolean {
  return (card.rank === 'K' || card.rank === 'Q') && hasMarriage(hand, card.suit) && !declared.includes(card.suit);
}

export interface CardContext {
  valid: Card[];
  trick: TrickCard[];
  trump: Suit | null;
  isBidder: boolean;
  bidder: PlayerId;
  hand: Card[];
  /** Cards from completed tricks this round. */
  played: Card[];
  /** Marriage suits this player has already declared. */
  declared?: Suit[];
}

export interface CardChoice {
  card: Card;
  reason: CardReason;
}

export function decideCard(ctx: CardContext): Card {
  return chooseCard(ctx).card;
}

export function chooseCard(ctx: CardContext): CardChoice {
  const declared = ctx.declared ?? [];
  if (ctx.valid.length === 1) return { card: ctx.valid[0], reason: { code: 'only', card: ctx.valid[0] } };
  if (ctx.trick.length > 0) {
    // Following: the K or Q of a held, undeclared marriage is thrown away unless nothing else is legal.
    const spare = ctx.valid.filter(c => !isMarriageCard(c, ctx.hand, declared));
    if (spare.length === 1 && spare.length < ctx.valid.length) {
      const kept = ctx.valid.find(c => isMarriageCard(c, ctx.hand, declared))!;
      return { card: spare[0], reason: { code: 'follow.keepMarriage', card: spare[0], suit: kept.suit } };
    }
    if (spare.length > 0 && spare.length < ctx.valid.length) return chooseCard({ ...ctx, valid: spare });
  }
  const unseen = remainingCards(ctx.hand, [...ctx.played, ...ctx.trick.map(t => t.card)]);
  if (ctx.trick.length === 0) return chooseLead(ctx, declared, unseen);
  return chooseFollow(ctx, unseen);
}

/** No unseen card of its suit outranks `card`. */
function isTop(card: Card, unseen: Card[]): boolean {
  return !unseen.some(u => u.suit === card.suit && STR[u.rank] > STR[card.rank]);
}

const lead = (card: Card, code: 'lead.top' | 'lead.drawTrump' | 'lead.lowTrump' | 'lead.probe' | 'lead.cheap'): CardChoice => ({
  card,
  reason: { code, card },
});

function chooseLead(ctx: CardContext, declared: Suit[], unseen: Card[]): CardChoice {
  const { valid, hand, trump, isBidder } = ctx;
  const marriage = marriageToDeclare(hand, declared);
  const queen = marriage && valid.find(c => c.suit === marriage && c.rank === 'Q');
  if (marriage && queen) {
    // No trump yet, so a side ace can't be trumped: cash those before the marriage sets one.
    const aces = isBidder && trump === null ? valid.filter(c => c.rank === 'A' && !hasMarriage(hand, c.suit)) : [];
    if (aces.length > 0) {
      const ace = pickSuitWithMostPoints(aces, unseen);
      return { card: ace, reason: { code: 'lead.cashAce', card: ace, marriage } };
    }
    return { card: queen, reason: { code: 'lead.declare', card: queen, suit: marriage, points: RULES.marriageValues[marriage] } };
  }
  const nonTrump = valid.filter(c => c.suit !== trump);
  if (isBidder) {
    // Lead aces first (non-trump: suit with most outstanding points).
    const aces = valid.filter(c => c.rank === 'A');
    if (aces.length > 0) {
      const nonTrumpAces = aces.filter(c => c.suit !== trump);
      return lead(nonTrumpAces.length > 0 ? pickSuitWithMostPoints(nonTrumpAces, unseen) : aces[0], 'lead.top');
    }
    // 10s whose ace is gone.
    for (const ten of valid.filter(c => c.rank === '10')) {
      if (!unseen.some(r => r.suit === ten.suit && r.rank === 'A')) return lead(ten, 'lead.top');
    }
    // Draw trumps: with the top trump if held, else with the lowest one (never a 10 into an unseen ace).
    if (trump) {
      const myTrumps = valid.filter(c => c.suit === trump);
      if (myTrumps.length >= 2 && unseen.some(c => c.suit === trump)) {
        const top = myTrumps.filter(c => isTop(c, unseen));
        if (top.length > 0) return lead(highestValue(top), 'lead.drawTrump');
        const loose = myTrumps.filter(c => !isMarriageCard(c, hand, declared));
        return lead(lowestValue(loose.length > 0 ? loose : myTrumps), 'lead.lowTrump');
      }
    }
    // Probe low from the longest non-trump suit.
    if (nonTrump.length > 0) {
      let longest: Card[] = [];
      for (const cards of groupBySuit(nonTrump).values()) if (cards.length > longest.length) longest = cards;
      return lead(lowestValue(longest), 'lead.probe');
    }
    return lead(lowestValue(valid), 'lead.cheap');
  }

  // Defender leading: cash sure side winners; never lead trumps (the bidder usually holds them).
  const nonTrumpAces = nonTrump.filter(c => c.rank === 'A');
  if (nonTrumpAces.length > 0) return lead(pickSuitWithMostPoints(nonTrumpAces, unseen), 'lead.top');
  const safeTens = nonTrump.filter(c => c.rank === '10' && !unseen.some(r => r.suit === c.suit && r.rank === 'A'));
  if (safeTens.length > 0) return lead(safeTens[0], 'lead.top');
  if (nonTrump.length > 0) {
    let bestSuit: Card[] | null = null;
    let bestScore = -1;
    const anyCheap = nonTrump.some(c => PTS[c.rank] < 10);
    for (const [suit, cards] of groupBySuit(nonTrump)) {
      const opponentCards = unseen.filter(c => c.suit === suit).length;
      if (opponentCards === 0) continue; // they'd trump us
      if (anyCheap && PTS[lowestValue(cards).rank] >= 10) continue; // don't give a 10 away to an unseen ace
      const score = cards.length * 2 + opponentCards;
      if (score > bestScore) {
        bestScore = score;
        bestSuit = cards;
      }
    }
    return lead(lowestValue(bestSuit ?? nonTrump), 'lead.cheap');
  }
  return lead(lowestValue(valid), 'lead.cheap');
}

function chooseFollow(ctx: CardContext, unseen: Card[]): CardChoice {
  const { valid, trick, trump, isBidder, bidder } = ctx;
  const leadSuit = trick[0].card.suit;
  const played = trick.map(t => t.card);
  const winningCard = currentWinner(played, leadSuit, trump);
  const winner = trick[played.indexOf(winningCard)].p;
  // Three players are active in every trick (a fourth player sits out), so the third card is the last.
  const last = trick.length >= 2;
  const take = (card: Card, code: 'follow.beat' | 'follow.trump'): CardChoice => ({
    card,
    reason: { code, card, last, points: handPoints([...played, card]) },
  });
  /** Losing (or not trying): lowest card; say so differently when the bidder is not the one winning. */
  const yieldTo = (card: Card): CardChoice =>
    !isBidder && winner !== bidder
      ? { card, reason: { code: 'follow.keepPoints', card, winner } }
      : { card, reason: { code: 'follow.cantWin', card } };

  if (!valid.some(c => c.suit === leadSuit)) {
    const myTrumps = trump ? valid.filter(c => c.suit === trump) : [];
    const beatingTrumps = myTrumps.filter(c => aiCanBeat(c, winningCard, leadSuit, trump));
    const dump = lowestExpendable(valid, trump);
    const discard: CardChoice = { card: dump, reason: { code: 'follow.discard', card: dump, led: leadSuit } };
    if (beatingTrumps.length === 0) return discard;
    if (isBidder) return take(lowestValue(beatingTrumps), 'follow.trump');
    if (winner !== bidder) return discard;
    // The bidder is winning: trump any trick with points in it (or when trumps are plentiful, or late on).
    const worthIt = handPoints(played) >= 4 || myTrumps.length >= 2 || unseen.length <= 12;
    return worthIt ? take(lowestValue(beatingTrumps), 'follow.trump') : discard;
  }
  // Following suit. Never feed points to anyone: win as cheaply as possible, else play the lowest card.
  // (The first responder must beat the lead when they can, so `beating` is often all that is legal.)
  const beating = valid.filter(c => aiCanBeat(c, winningCard, leadSuit, trump));
  if (beating.length > 0) return take(lowestValue(beating), 'follow.beat');
  return yieldTo(lowestValue(valid));
}
