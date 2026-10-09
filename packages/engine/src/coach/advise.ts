import type { Action, Advice, Card, PlayerId, PlayerView, Suit } from '../types';
import { RANKS, RULES, SUITS, SUIT_SYMBOL } from '../rules';
import { cardEquals, cardLabel, handPoints, hasMarriage, marriagesInHand } from '../cards';
import { maxBidFor } from '../bidding';
import { canBeat, getHighestCardInTrick } from '../tricks';
import { roundToTen } from '../scoring';
import { botAction } from '../bot';
import { expectedBidPoints, postTalonExpectedPoints } from '../bot/eval';
import { nameOf } from './names';

const MV = RULES.marriageValues;
const STR = RULES.rankStrength;
const sym = (suit: Suit): string => SUIT_SYMBOL[suit];

/** The coach's recommendation for the viewer's current decision, or null when there is none. */
export function advise(view: PlayerView): Advice | null {
  const r = view.round;
  if (!r || view.paused || view.turn !== view.me) return null;
  if (!view.legal.some(a => a.type !== 'pause' && a.type !== 'resume')) return null;
  const action = botAction(view, () => 0);
  switch (action.type) {
    case 'bid':
    case 'pass':
      return adviseBid(view, action);
    case 'play':
    case 'throw':
      return adviseDecision(view, action);
    case 'handout':
      return adviseHandout(view, action, action.to);
    case 'card':
      return adviseCard(view, action, action.card);
    default:
      return null;
  }
}

function adviseBid(view: PlayerView, action: Action): Advice {
  const r = view.round!;
  const hand = r.hand;
  const next = r.bid.amount + RULES.bidStep;
  const max = maxBidFor(hand);
  const worth = roundToTen(Math.round(expectedBidPoints(hand)));
  const headline =
    action.type === 'bid'
      ? `Bid ${next} — this hand looks worth about ${worth}`
      : next > max
        ? `Pass — you can't bid above ${max}`
        : `Pass — ${next} is more than this hand is likely to make`;
  const reasons = [`Your max bid is ${max} (120 + marriages in hand)`];
  for (const suit of marriagesInHand(hand)) {
    reasons.push(`K+Q ${sym(suit)} marriage: +${MV[suit]} when you lead the Q and win a trick`);
  }
  const aces = hand.filter(c => c.rank === 'A').length;
  if (aces > 0) reasons.push(`${aces} ace${aces > 1 ? 's' : ''} — 11 points each and usually a trick`);
  reasons.push('The talon adds 3 unseen cards — count on roughly 10 points from it');
  if (action.type === 'bid' && r.bid.passed.length > 0) reasons.push('Someone already passed, so a little extra risk is fine');
  return { action, headline, reasons };
}

function adviseDecision(view: PlayerView, action: Action): Advice {
  const r = view.round!;
  const hand = r.hand;
  const bid = r.bid.amount;
  const est = roundToTen(Math.round(postTalonExpectedPoints(hand)));
  const free = bid <= RULES.autoBid;
  const headline =
    action.type === 'play'
      ? `Play — you can expect about ${est} toward your ${bid}`
      : free
        ? "Throw in — it's free at 100 and this hand looks weak"
        : `Throw in — ${bid} looks out of reach (about ${est})`;
  const share = Math.floor(RULES.throwPool / 2);
  const reasons = [
    free
      ? 'Throwing at 100 costs nothing: the cards are simply dealt again'
      : `Throwing costs you ${bid} and gives each opponent ${share} (0 if on the barrel)`,
    `Playing and falling short costs ${bid}`,
  ];
  for (const suit of marriagesInHand(hand)) reasons.push(`Your K+Q ${sym(suit)} marriage is worth ${MV[suit]}`);
  const voids = SUITS.filter(s => !hand.some(c => c.suit === s));
  if (voids.length > 0) reasons.push(`You're void in ${voids.map(sym).join(' ')} — you can trump those leads`);
  return { action, headline, reasons };
}

function adviseHandout(view: PlayerView, action: Action, to: Record<PlayerId, Card>): Advice {
  const r = view.round!;
  const entries = Object.entries(to);
  const headline = `Give ${entries.map(([p, card]) => `${cardLabel(card)} to ${nameOf(view, p)}`).join(' and ')}`;
  const given = entries.map(([, card]) => card);
  const after = r.hand.filter(h => !given.some(g => cardEquals(g, h)));
  const reasons: string[] = [];
  for (const card of given) {
    if (!after.some(h => h.suit === card.suit)) {
      reasons.push(`Giving ${cardLabel(card)} leaves you void in ${sym(card.suit)} — you can trump that suit later`);
    } else if (handPoints([card]) === 0) {
      reasons.push(`${cardLabel(card)} is worth 0 points`);
    } else {
      reasons.push(`${cardLabel(card)} is one of your least useful cards`);
    }
  }
  if (marriagesInHand(after).length > 0) reasons.push('Keep your K+Q pairs — each one is a marriage');
  if (after.some(h => h.rank === 'A')) reasons.push('Keep your aces — they win tricks');
  if (entries.length === 2) {
    const [p1, p2] = entries.map(([p]) => p);
    const t1 = view.scores[p1]?.total ?? 0;
    const t2 = view.scores[p2]?.total ?? 0;
    if (t1 !== t2) reasons.push(`The better card goes to ${nameOf(view, t1 < t2 ? p1 : p2)}, who has the lower score`);
  }
  return { action, headline, reasons: [...new Set(reasons)] };
}

function adviseCard(view: PlayerView, action: Action, card: Card): Advice {
  const r = view.round!;
  const label = cardLabel(card);
  const legalCards = view.legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
  const reasons: string[] = [];
  if (legalCards.length === 1) reasons.push("It's your only legal card");

  if (r.trick.cards.length === 0) {
    const declared = r.marriages[view.me] ?? [];
    if (card.rank === 'Q' && hasMarriage(r.hand, card.suit) && !declared.includes(card.suit)) {
      return {
        action,
        headline: `Lead ${label} to declare your ${sym(card.suit)} marriage`,
        reasons: [
          `Leading a Q with its K in hand declares the marriage: +${MV[card.suit]}`,
          `${sym(card.suit)} become trumps straight away — even for this trick`,
          'Marriage points only count if you win at least one trick',
        ],
      };
    }
    const known = [...r.played, ...r.hand];
    const higherOut = RANKS.some(
      rank => STR[rank] > STR[card.rank] && !known.some(k => k.suit === card.suit && k.rank === rank),
    );
    if (!higherOut) reasons.push(`${label} is the highest ${sym(card.suit)} left — a likely winner`);
    else if (r.trump === card.suit) reasons.push("Leading trumps pulls trumps out of your opponents' hands");
    else reasons.push('A low lead feels out the suit without risking points');
    return { action, headline: `Lead ${label}`, reasons };
  }

  const lead = r.trick.cards[0].card;
  const onTable = r.trick.cards.map(t => t.card);
  const winning = getHighestCardInTrick(onTable, lead.suit, r.trump);
  const winner = r.trick.cards.find(t => cardEquals(t.card, winning))!.p;
  const wins = cardEquals(getHighestCardInTrick([...onTable, card], lead.suit, r.trump), card);
  const holdsLead = r.hand.some(h => h.suit === lead.suit);
  if (!holdsLead) {
    reasons.push(`You have no ${sym(lead.suit)}, so any card is allowed`);
  } else if (r.trick.cards.length === 1 && r.hand.some(h => h.suit === lead.suit && canBeat(h, lead, lead.suit, r.trump))) {
    reasons.push(`As first to respond you must beat ${cardLabel(lead)} if you can`);
  }
  if (wins) {
    const last = r.trick.cards.length === r.active.length - 1;
    reasons.push(
      last
        ? `${label} takes the trick (${handPoints([...onTable, card])} points)`
        : `${label} beats everything played so far`,
    );
    if (r.trump && card.suit === r.trump && lead.suit !== r.trump) {
      reasons.push(`Trumps (${sym(r.trump)}) beat every other suit`);
    }
  } else if (view.me !== r.bid.high && winner !== r.bid.high) {
    const pts = handPoints([card]);
    reasons.push(
      pts > 0
        ? `${nameOf(view, winner)} is winning — ${label} feeds them ${pts} points`
        : `${nameOf(view, winner)} is winning — no need to fight for it`,
    );
  } else {
    reasons.push("You can't win this one, so play your least useful card");
  }
  return { action, headline: `Play ${label}`, reasons };
}
