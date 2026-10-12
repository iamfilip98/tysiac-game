import type { Action, Advice, Card, PlayerId, PlayerView, Suit } from '../types';
import { RULES, SUITS } from '../rules';
import { cardEquals, handPoints, hasMarriage, marriagesInHand } from '../cards';
import { canBeat, getHighestCardInTrick } from '../tricks';
import { botAction, botChoice } from '../bot';
import { decideHandout } from '../bot/eval';
import { actionsEqual } from '../actions';
import { isOnBarrel } from '../scoring';
import { isMarriageCard } from '../bot/play';
import type { BidReason, CardReason, DecisionReason, HandoutReason } from '../bot/reasons';
import { msg, type EngineMsg } from '../messages';

const MV = RULES.marriageValues;
const PTS = RULES.cardPoints;
const sym = (suit: Suit) => ({ suit });
const cd = (card: Card) => ({ card });
const pl = (player: PlayerId) => ({ player });

/** Drops repeated messages (same key and params), keeping the first. */
function uniq(list: EngineMsg[]): EngineMsg[] {
  const seen = new Set<string>();
  return list.filter(m => {
    const k = JSON.stringify(m);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

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
  if (!view.legal.some(a => actionsEqual(a, action))) {
    // Never advise an illegal move: fall back to the bot's own legal pick, without an explanation we can't vouch for.
    const fallback = botAction(view, () => 0);
    return fallback.type === 'card' ? { action: fallback, headline: msg('coach.play', { card: cd(fallback.card) }), reasons: [] } : null;
  }
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
      ? msg('coach.pass.overMax', { max: reason.max })
      : msg(`coach.${reason.code}` as const, { next: reason.next, worth: reason.worth });
  const reasons = [msg('coach.why.maxBid', { max })];
  if (reason.code === 'pass.overMax') return { action, headline, reasons };
  for (const suit of marriagesInHand(hand)) reasons.push(msg('coach.why.marriageBid', { suit: sym(suit), points: MV[suit] }));
  const aces = hand.filter(c => c.rank === 'A').length;
  if (aces === 1) reasons.push(msg('coach.why.ace'));
  if (aces > 1) reasons.push(msg('coach.why.aces', { n: aces }));
  reasons.push(msg('coach.why.talon'));
  if (reason.boosted) reasons.push(msg('coach.why.boosted'));
  if (reason.code === 'bid.close') reasons.push(msg('coach.why.closeBid'));
  return { action, headline, reasons: reasons.slice(0, 6) };
}

function adviseDecision(view: PlayerView, action: Action, reason: DecisionReason): Advice {
  const r = view.round!;
  const hand = r.hand;
  const { bid, est } = reason;
  const share = Math.floor(RULES.throwPool / 2);
  const opponents = r.active.filter(p => p !== view.me);
  const onBarrel = opponents.filter(p => isOnBarrel(view.scores[p]?.total ?? 0));
  let headline: EngineMsg;
  if (reason.code === 'throw.free') headline = est < 10 ? msg('coach.throw.freeNothing') : msg('coach.throw.free', { est });
  else if (reason.code === 'play.noThrow' && onBarrel.length === opponents.length) headline = msg('coach.play.noThrowBarrel', { bid });
  else if (reason.code === 'play.noThrow' && onBarrel.length > 0) {
    const other = opponents.find(p => !onBarrel.includes(p))!;
    headline = msg('coach.play.noThrowOne', { bid, player: pl(other), share, barrel: pl(onBarrel[0]) });
  } else if (reason.code === 'play.noThrow') headline = msg('coach.play.noThrow', { bid, share });
  else headline = msg(`coach.${reason.code}` as const, { est, bid });
  const reasons: EngineMsg[] = [];
  if (reason.code === 'play.noThrow') reasons.push(msg('coach.why.estimate', { est }));
  if (bid <= RULES.autoBid) reasons.push(msg('coach.why.throwFree'));
  else if (reason.code !== 'play.noThrow') reasons.push(msg('coach.why.throwCost', { bid, share }));
  reasons.push(msg('coach.why.failCost', { bid }));
  for (const suit of marriagesInHand(hand)) reasons.push(msg('coach.why.marriageWorth', { suit: sym(suit), points: MV[suit] }));
  const voids = SUITS.filter(s => !hand.some(c => c.suit === s));
  if (voids.length > 0) reasons.push(msg(r.trump ? 'coach.why.voidTrump' : 'coach.why.voidNoTrump', { suits: { and: voids.map(sym) } }));
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
  const named = (p: PlayerId, card: Card) => ({ card: cd(card), player: pl(p) });
  const warnings: EngineMsg[] = [];
  let headline: EngineMsg;
  if (gives.length === 2) {
    const [a, b] = gives.map(g => named(g.to, g.card));
    headline = msg('coach.handout.two', { card1: a.card, player1: a.player, card2: b.card, player2: b.player });
  } else if (gives.length === 1) {
    headline = msg('coach.handout.one', named(gives[0].to, gives[0].card));
  } else {
    // Every card is assigned already: the player's own choice. Praise it only if it is what the bot would give.
    const [a, b] = Object.entries(to).map(([p, card]) => named(p, card));
    const best = decideHandout(r.hand, Object.keys(to), Object.fromEntries(Object.keys(to).map(p => [p, view.scores[p]?.total ?? 0]))).action;
    const bestTo = best.type === 'handout' ? best.to : {};
    const same = Object.entries(to).every(([p, card]) => bestTo[p] && cardEquals(bestTo[p], card));
    headline = msg(same ? 'coach.handout.confirm' : 'coach.handout.confirmNeutral', { card1: a.card, player1: a.player, card2: b.card, player2: b.player });
    if (!same) {
      const better = { and: Object.values(bestTo).map(cd) };
      for (const card of Object.values(to)) {
        if ((card.rank === 'K' || card.rank === 'Q') && hasMarriage(r.hand, card.suit)) {
          warnings.push(msg('coach.warn.marriage', { card: cd(card), suit: sym(card.suit), better }));
        } else if (card.rank === 'A' || card.rank === '10') {
          warnings.push(msg('coach.warn.points', { card: cd(card), points: PTS[card.rank], better }));
        }
      }
    }
  }
  const all = Object.values(to);
  const after = r.hand.filter(h => !all.some(g => cardEquals(g, h)));
  const reasons: EngineMsg[] = [...warnings];
  for (const { card, why } of gives) {
    const label = cd(card);
    if (why === 'void') reasons.push(msg(r.trump ? 'coach.give.voidTrump' : 'coach.give.voidNoTrump', { card: label, suit: sym(card.suit) }));
    else if (why === 'zero') reasons.push(msg('coach.give.zero', { card: label }));
    else if (why === 'low') reasons.push(msg('coach.give.low', { card: label, points: PTS[card.rank] }));
    else reasons.push(msg('coach.give.forced', { card: label }));
  }
  if (marriagesInHand(after).length > 0) reasons.push(msg('coach.why.keepMarriages'));
  if (after.some(h => h.rank === 'A')) reasons.push(msg('coach.why.keepAces'));
  if (after.some(h => (h.rank === 'K' || h.rank === 'Q') && !hasMarriage(r.hand, h.suit))) reasons.push(msg('coach.why.keepLoneKQ'));
  if (reason.betterTo) reasons.push(msg('coach.why.betterTo', { player: pl(reason.betterTo) }));
  return { action, headline, reasons: uniq(reasons).slice(0, 6) };
}

function adviseCard(view: PlayerView, action: Action, reason: CardReason): Advice {
  const r = view.round!;
  const card = reason.card;
  const label = cd(card);
  const legalCards = view.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
  const declared = r.marriages[view.me] ?? [];
  const isBidder = view.me === r.bid.high;
  const reasons: EngineMsg[] = [];
  if (legalCards.length === 1) reasons.push(msg('coach.why.only'));

  if (r.trick.cards.length === 0) {
    let headline: EngineMsg;
    switch (reason.code) {
      case 'lead.declare':
        return {
          action,
          headline: msg('coach.lead.declare', { card: label, suit: sym(reason.suit) }),
          reasons: [
            msg('coach.why.declare', { points: reason.points }),
            msg('coach.why.declareTrump', { suit: sym(reason.suit) }),
            msg('coach.why.declareTrick'),
          ],
        };
      case 'lead.cashAce':
        headline = msg('coach.lead.cashAce', { card: label });
        reasons.push(msg('coach.why.cashAce', { card: label }), msg('coach.why.cashAceThen', { suit: sym(reason.marriage), points: MV[reason.marriage] }));
        break;
      case 'lead.top':
        headline = msg('coach.lead.top', { card: label, suit: sym(card.suit) });
        reasons.push(msg(r.trump && card.suit !== r.trump ? 'coach.why.top' : 'coach.why.topSafe', { suit: sym(card.suit) }));
        break;
      case 'lead.drawTrump':
        headline = msg('coach.lead.drawTrump', { card: label });
        reasons.push(msg('coach.why.drawTrump'));
        break;
      case 'lead.lowTrump':
        headline = msg('coach.lead.lowTrump', { card: label });
        reasons.push(msg('coach.why.lowTrump'));
        break;
      case 'lead.probe':
        headline = msg('coach.lead.probe', { card: label });
        reasons.push(msg('coach.why.probe'));
        break;
      case 'lead.cheap':
        headline = msg('coach.lead.cheap', { card: label });
        reasons.push(PTS[card.rank] < 10 ? msg('coach.why.cheap', { card: label, points: PTS[card.rank] }) : msg('coach.why.cheapest'));
        break;
      default:
        headline = msg(reason.code === 'only' ? 'coach.lead.only' : 'coach.play', { card: label });
    }
    if (!isBidder && r.trump && card.suit !== r.trump && r.hand.some(h => h.suit === r.trump)) reasons.push(msg('coach.why.noTrumpLead'));
    return { action, headline, reasons };
  }

  // Following: first the rule that limits the choice, then why this card.
  const lead = r.trick.cards[0].card;
  if (!r.hand.some(h => h.suit === lead.suit)) {
    reasons.push(msg('coach.why.noSuit', { suit: sym(lead.suit) }));
  } else if (r.trick.cards.length === 1 && r.hand.some(h => h.suit === lead.suit && canBeat(h, lead, lead.suit, r.trump))) {
    reasons.push(msg('coach.why.mustBeat', { card: cd(lead) }));
  } else if (r.trick.cards.length >= 2) {
    reasons.push(msg('coach.why.followOnly'));
  }
  switch (reason.code) {
    case 'follow.beat':
    case 'follow.trump':
      reasons.push(reason.last ? msg('coach.follow.takes', { card: label, points: reason.points }) : msg('coach.follow.beats', { card: label }));
      if (reason.code === 'follow.trump') reasons.push(msg('coach.why.trumps', { suit: sym(r.trump!) }));
      break;
    case 'follow.cantWin':
      reasons.push(msg('coach.follow.cantWin'));
      break;
    case 'follow.keepPoints':
      reasons.push(msg('coach.follow.keepPoints', { player: pl(reason.winner) }));
      break;
    case 'follow.keepMarriage':
      reasons.push(msg('coach.follow.keepMarriage', { card: label, suit: sym(reason.suit) }));
      break;
    case 'follow.discard':
      reasons.push(msg('coach.follow.discard'));
      break;
    case 'only': {
      const onTable = r.trick.cards.map(t => t.card);
      if (cardEquals(getHighestCardInTrick([...onTable, card], lead.suit, r.trump), card)) {
        const last = r.trick.cards.length === r.active.length - 1;
        reasons.push(last ? msg('coach.follow.takes', { card: label, points: handPoints([...onTable, card]) }) : msg('coach.follow.beats', { card: label }));
      }
      break;
    }
    default:
      break;
  }
  if (isMarriageCard(card, r.hand, declared)) {
    const forced = legalCards.every(lc => isMarriageCard(lc, r.hand, declared));
    reasons.push(msg(forced ? 'coach.why.breaksMarriageForced' : 'coach.why.breaksMarriage', { suit: sym(card.suit) }));
  }
  return { action, headline: msg('coach.play', { card: label }), reasons: uniq(reasons) };
}
