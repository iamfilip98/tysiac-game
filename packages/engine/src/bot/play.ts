import type { Card, PlayerId, Suit, TrickCard } from '../types';
import { RANKS, RULES, SUITS } from '../rules';
import { cardEquals, hasMarriage } from '../cards';
import { cardValue } from './eval';

const PTS = RULES.cardPoints;
const STR = RULES.rankStrength;

export function lowestValue(cards: Card[]): Card {
  return [...cards].sort((a, b) => cardValue(a) - cardValue(b))[0];
}

export function highestValue(cards: Card[]): Card {
  return [...cards].sort((a, b) => cardValue(b) - cardValue(a))[0];
}

export function highestPoints(cards: Card[]): Card {
  return [...cards].sort((a, b) => PTS[b.rank] - PTS[a.rank])[0];
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

export interface CardContext {
  valid: Card[];
  trick: TrickCard[];
  trump: Suit | null;
  isBidder: boolean;
  bidder: PlayerId;
  hand: Card[];
  /** Cards from completed tricks this round. */
  played: Card[];
}

export function decideCard(ctx: CardContext): Card {
  if (ctx.valid.length === 1) return ctx.valid[0];
  const remaining = remainingCards(ctx.hand, [...ctx.played, ...ctx.trick.map(t => t.card)]);
  if (ctx.trick.length === 0) return decideLeadCard(ctx.valid, ctx.trump, ctx.isBidder, remaining);
  return decideFollowCard(ctx.valid, ctx.trick, ctx.trump, ctx.isBidder, ctx.bidder, remaining);
}

function decideLeadCard(valid: Card[], trump: Suit | null, isBidder: boolean, remaining: Card[]): Card {
  if (isBidder) {
    // Lead aces first (non-trump: suit with most outstanding points).
    const aces = valid.filter(c => c.rank === 'A');
    if (aces.length > 0) {
      const nonTrumpAces = aces.filter(c => c.suit !== trump);
      if (nonTrumpAces.length > 0) return pickSuitWithMostPoints(nonTrumpAces, remaining);
      return aces[0];
    }
    // 10s whose ace is gone.
    for (const ten of valid.filter(c => c.rank === '10')) {
      if (!remaining.some(r => r.suit === ten.suit && r.rank === 'A')) return ten;
    }
    // Pull trumps with a strong trump holding.
    if (trump) {
      const myTrumps = valid.filter(c => c.suit === trump);
      if (myTrumps.length >= 2 && remaining.some(c => c.suit === trump)) return highestValue(myTrumps);
    }
    // Probe low from the longest non-trump suit.
    const nonTrump = valid.filter(c => c.suit !== trump);
    if (nonTrump.length > 0) {
      let longest: Card[] | null = null;
      for (const cards of groupBySuit(nonTrump).values()) {
        if (!longest || cards.length > longest.length) longest = cards;
      }
      if (longest) return lowestValue(longest);
    }
    return lowestValue(valid);
  }

  // Defender leading: grab points.
  const nonTrumpAces = valid.filter(c => c.rank === 'A' && c.suit !== trump);
  if (nonTrumpAces.length > 0) return pickSuitWithMostPoints(nonTrumpAces, remaining);
  const safeTens = valid.filter(
    c => c.rank === '10' && c.suit !== trump && !remaining.some(r => r.suit === c.suit && r.rank === 'A'),
  );
  if (safeTens.length > 0) return safeTens[0];
  if (trump) {
    const myTrumps = valid.filter(c => c.suit === trump);
    if (myTrumps.length >= 2 && remaining.some(c => c.suit === trump)) return lowestValue(myTrumps);
  }
  const nonTrumpCards = valid.filter(c => c.suit !== trump);
  if (nonTrumpCards.length > 0) {
    let bestSuit: Card[] | null = null;
    let bestScore = -1;
    for (const [suit, cards] of groupBySuit(nonTrumpCards)) {
      const opponentCards = remaining.filter(c => c.suit === suit).length;
      if (opponentCards === 0) continue; // they'd trump us
      const score = cards.length * 2 + opponentCards;
      if (score > bestScore) {
        bestScore = score;
        bestSuit = cards;
      }
    }
    if (bestSuit) return lowestValue(bestSuit);
    return lowestValue(nonTrumpCards);
  }
  return lowestValue(valid);
}

function decideFollowCard(
  valid: Card[],
  trick: TrickCard[],
  trump: Suit | null,
  isBidder: boolean,
  bidder: PlayerId,
  remaining: Card[],
): Card {
  const leadSuit = trick[0].card.suit;
  const played = trick.map(t => t.card);
  const winningCard = currentWinner(played, leadSuit, trump);
  const winningPlayer = trick[played.indexOf(winningCard)].p;
  const followingSuit = valid.some(c => c.suit === leadSuit);
  const beating = valid.filter(c => aiCanBeat(c, winningCard, leadSuit, trump));

  if (!followingSuit) {
    return decideOffSuitCard(valid, trick, trump, isBidder, bidder, winningCard, winningPlayer, remaining);
  }
  if (isBidder) return beating.length > 0 ? lowestValue(beating) : lowestValue(valid);

  if (trick.length === 1) {
    if (trick[0].p === bidder) return beating.length > 0 ? lowestValue(beating) : lowestValue(valid);
    const partnerCard = played[0];
    if (STR[partnerCard.rank] >= 4) {
      // Partner led a 10 or A: feed points without overtaking.
      const feed = valid.filter(c => !aiCanBeat(c, partnerCard, leadSuit, trump));
      return feed.length > 0 ? highestPoints(feed) : lowestValue(valid);
    }
    return beating.length > 0 ? lowestValue(beating) : lowestValue(valid);
  }

  if (winningPlayer !== bidder) {
    const feed = valid.filter(c => !aiCanBeat(c, winningCard, leadSuit, trump));
    return feed.length > 0 ? highestPoints(feed) : lowestValue(valid);
  }
  return beating.length > 0 ? lowestValue(beating) : lowestValue(valid);
}

function decideOffSuitCard(
  valid: Card[],
  trick: TrickCard[],
  trump: Suit | null,
  isBidder: boolean,
  bidder: PlayerId,
  winningCard: Card,
  winningPlayer: PlayerId,
  remaining: Card[],
): Card {
  const leadSuit = trick[0].card.suit;
  const myTrumps = trump ? valid.filter(c => c.suit === trump) : [];
  const trickPointValue = trick.reduce((sum, t) => sum + PTS[t.card.rank], 0);
  const beatingTrumps = myTrumps.filter(c => aiCanBeat(c, winningCard, leadSuit, trump));

  if (isBidder) return beatingTrumps.length > 0 ? lowestValue(beatingTrumps) : lowestExpendable(valid, trump);
  if (winningPlayer !== bidder) return lowestExpendable(valid, trump); // partner winning: dump
  if (beatingTrumps.length > 0) {
    if (trickPointValue >= 10 || myTrumps.length >= 2) return lowestValue(beatingTrumps);
    if (remaining.length <= 12) return lowestValue(beatingTrumps); // late game: fight for every trick
  }
  return lowestExpendable(valid, trump);
}
