import type { Action, Advice, Card, PlayerId, PlayerView, Suit } from '../types';
import { RULES, SUITS, SUIT_SYMBOL } from '../rules';
import { cardEquals, cardLabel, handPoints, hasMarriage, marriagesInHand } from '../cards';
import { canBeat, getHighestCardInTrick } from '../tricks';
import { botChoice } from '../bot';
import { isMarriageCard } from '../bot/play';
import type { BidReason, CardReason, DecisionReason, HandoutReason } from '../bot/reasons';
import { nameOf } from './names';
import { say } from './messages';

const MV = RULES.marriageValues;
const PTS = RULES.cardPoints;
const sym = (suit: Suit): string => SUIT_SYMBOL[suit];

export interface AdviseOptions {
  /** Hand-out cards the player has already assigned in the UI; the advice then covers the rest. */
  handoutGiven?: Partial<Record<PlayerId, Card>>;
}

/**
 * The coach's recommendation for the viewer's current decision, or null when there is none.
 * The action and the explanation both come from the bot's own choice (`botChoice`), so the text always
 * quotes the numbers and the rule the decision actually used.
 */
export function advise(view: PlayerView, opts: AdviseOptions = {}): Advice | null {
  const r = view.round;
  if (!r || view.paused || view.turn !== view.me) return null;
  if (!view.legal.some(a => a.type !== 'pause' && a.type !== 'resume')) return null;
  const choice = botChoice(view, opts);
  if (!choice) return null;
  const { action, reason } = choice;
  switch (reason.code) {
    case 'bid.worth':
    case 'bid.close':
    case 'pass.overMax':
    case 'pass.worth':
      return adviseBid(view, action, reason);
    case 'play.enough':
    case 'play.close':
    case 'play.noThrow':
    case 'throw.free':
      return adviseDecision(view, action, reason);
    case 'handout':
      return adviseHandout(view, action, reason);
    default:
      return adviseCard(view, action, reason);
  }
}

function adviseBid(view: PlayerView, action: Action, reason: BidReason): Advice {
  const hand = view.round!.hand;
  const max = view.round!.maxBid;
  const headline =
    reason.code === 'pass.overMax'
      ? say(reason.code, { max: reason.max })
      : say(reason.code, { next: reason.next, worth: reason.worth });
  const reasons = [say('why.maxBid', { max })];
  if (reason.code === 'pass.overMax') return { action, headline, reasons };
  for (const suit of marriagesInHand(hand)) reasons.push(say('why.marriageBid', { suit: sym(suit), points: MV[suit] }));
  const aces = hand.filter(c => c.rank === 'A').length;
  if (aces === 1) reasons.push(say('why.ace'));
  if (aces > 1) reasons.push(say('why.aces', { count: aces }));
  reasons.push(say('why.talon'));
  if (reason.boosted) reasons.push(say('why.boosted'));
  if (reason.code === 'bid.close') reasons.push(say('why.closeBid'));
  return { action, headline, reasons: reasons.slice(0, 6) };
}

function adviseDecision(view: PlayerView, action: Action, reason: DecisionReason): Advice {
  const r = view.round!;
  const hand = r.hand;
  const { bid, est } = reason;
  const share = Math.floor(RULES.throwPool / 2);
  const headline = say(reason.code, { est, bid, share });
  const reasons: string[] = [];
  if (reason.code === 'play.noThrow') reasons.push(say('why.estimate', { est }));
  if (bid <= RULES.autoBid) reasons.push(say('why.throwFree'));
  else if (reason.code !== 'play.noThrow') reasons.push(say('why.throwCost', { bid, share }));
  reasons.push(say('why.failCost', { bid }));
  for (const suit of marriagesInHand(hand)) reasons.push(say('why.marriageWorth', { suit: sym(suit), points: MV[suit] }));
  const voids = SUITS.filter(s => !hand.some(c => c.suit === s));
  if (voids.length > 0) reasons.push(say(r.trump ? 'why.voidTrump' : 'why.voidNoTrump', { suits: voids.map(sym).join(' ') }));
  return { action, headline, reasons };
}

function adviseHandout(
  view: PlayerView,
  action: Action,
  reason: HandoutReason,
): Advice {
  const r = view.round!;
  const to = action.type === 'handout' ? action.to : {};
  const gives = reason.gives;
  const named = (p: PlayerId, card: Card) => ({ card: cardLabel(card), name: nameOf(view, p) });
  let headline: string;
  if (gives.length === 2) {
    const [a, b] = gives.map(g => named(g.to, g.card));
    headline = say('handout.two', { card1: a.card, name1: a.name, card2: b.card, name2: b.name });
  } else if (gives.length === 1) {
    headline = say('handout.one', named(gives[0].to, gives[0].card));
  } else {
    // Every card is assigned already: the player's own choice, confirmed.
    const [a, b] = Object.entries(to).map(([p, card]) => named(p, card));
    headline = say('handout.confirm', { card1: a.card, name1: a.name, card2: b.card, name2: b.name });
  }
  const all = Object.values(to);
  const after = r.hand.filter(h => !all.some(g => cardEquals(g, h)));
  const reasons: string[] = [];
  for (const { card, why } of gives) {
    const label = cardLabel(card);
    if (why === 'void') reasons.push(say(r.trump ? 'give.voidTrump' : 'give.voidNoTrump', { card: label, suit: sym(card.suit) }));
    else if (why === 'zero') reasons.push(say('give.zero', { card: label }));
    else if (why === 'low') reasons.push(say('give.low', { card: label, points: PTS[card.rank] }));
    else reasons.push(say('give.forced', { card: label }));
  }
  if (marriagesInHand(after).length > 0) reasons.push(say('why.keepMarriages'));
  if (after.some(h => h.rank === 'A')) reasons.push(say('why.keepAces'));
  if (after.some(h => (h.rank === 'K' || h.rank === 'Q') && !hasMarriage(r.hand, h.suit))) reasons.push(say('why.keepLoneKQ'));
  if (reason.betterTo) reasons.push(say('why.betterTo', { name: nameOf(view, reason.betterTo) }));
  return { action, headline, reasons: [...new Set(reasons)].slice(0, 6) };
}

function adviseCard(view: PlayerView, action: Action, reason: CardReason): Advice {
  const r = view.round!;
  const card = reason.card;
  const label = cardLabel(card);
  const legalCards = view.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
  const declared = r.marriages[view.me] ?? [];
  const isBidder = view.me === r.bid.high;
  const reasons: string[] = [];
  if (legalCards.length === 1) reasons.push(say('why.only'));

  if (r.trick.cards.length === 0) {
    let headline: string;
    switch (reason.code) {
      case 'lead.declare':
        return {
          action,
          headline: say('lead.declare', { card: label, suit: sym(reason.suit) }),
          reasons: [
            say('why.declare', { points: reason.points }),
            say('why.declareTrump', { suit: sym(reason.suit) }),
            say('why.declareTrick'),
          ],
        };
      case 'lead.cashAce':
        headline = say('lead.cashAce', { card: label });
        reasons.push(say('why.cashAce', { card: label }), say('why.cashAceThen', { suit: sym(reason.marriage), points: MV[reason.marriage] }));
        break;
      case 'lead.top':
        headline = say('lead.top', { card: label, suit: sym(card.suit) });
        reasons.push(say(r.trump && card.suit !== r.trump ? 'why.top' : 'why.topSafe', { suit: sym(card.suit) }));
        break;
      case 'lead.drawTrump':
        headline = say('lead.drawTrump', { card: label });
        reasons.push(say('why.drawTrump'));
        break;
      case 'lead.lowTrump':
        headline = say('lead.lowTrump', { card: label });
        reasons.push(say('why.lowTrump'));
        break;
      case 'lead.probe':
        headline = say('lead.probe', { card: label });
        reasons.push(say('why.probe'));
        break;
      case 'lead.cheap':
        headline = say('lead.cheap', { card: label });
        reasons.push(PTS[card.rank] < 10 ? say('why.cheap', { card: label, points: PTS[card.rank] }) : say('why.cheapest'));
        break;
      default:
        headline = say('play', { card: label });
    }
    if (!isBidder && r.trump && card.suit !== r.trump && r.hand.some(h => h.suit === r.trump)) reasons.push(say('why.noTrumpLead'));
    return { action, headline, reasons };
  }

  // Following: first the rule that limits the choice, then why this card.
  const lead = r.trick.cards[0].card;
  if (!r.hand.some(h => h.suit === lead.suit)) {
    reasons.push(say('why.noSuit', { suit: sym(lead.suit) }));
  } else if (r.trick.cards.length === 1 && r.hand.some(h => h.suit === lead.suit && canBeat(h, lead, lead.suit, r.trump))) {
    reasons.push(say('why.mustBeat', { card: cardLabel(lead) }));
  } else if (r.trick.cards.length >= 2) {
    reasons.push(say('why.followOnly'));
  }
  switch (reason.code) {
    case 'follow.beat':
    case 'follow.trump':
      reasons.push(reason.last ? say('follow.takes', { card: label, points: reason.points }) : say('follow.beats', { card: label }));
      if (reason.code === 'follow.trump') reasons.push(say('why.trumps', { suit: sym(r.trump!) }));
      break;
    case 'follow.cantWin':
      reasons.push(say('follow.cantWin'));
      break;
    case 'follow.keepPoints':
      reasons.push(say('follow.keepPoints', { name: nameOf(view, reason.winner) }));
      break;
    case 'follow.keepMarriage':
      reasons.push(say('follow.keepMarriage', { card: label, suit: sym(reason.suit) }));
      break;
    case 'follow.discard':
      reasons.push(say('follow.discard'));
      break;
    case 'only': {
      const onTable = r.trick.cards.map(t => t.card);
      if (cardEquals(getHighestCardInTrick([...onTable, card], lead.suit, r.trump), card)) {
        const last = r.trick.cards.length === r.active.length - 1;
        reasons.push(last ? say('follow.takes', { card: label, points: handPoints([...onTable, card]) }) : say('follow.beats', { card: label }));
      }
      break;
    }
    default:
      break;
  }
  if (isMarriageCard(card, r.hand, declared)) {
    const forced = legalCards.every(lc => isMarriageCard(lc, r.hand, declared));
    reasons.push(say(forced ? 'why.breaksMarriageForced' : 'why.breaksMarriage', { suit: sym(card.suit) }));
  }
  return { action, headline: say('play', { card: label }), reasons: [...new Set(reasons)] };
}
