import type { Action, Card, PlayerId, Suit } from '../types';

/**
 * Why the bot chose its move, with the exact numbers it used. The coach (coach/advise.ts) turns these
 * into sentences, so the advice can never quote a number or a rule the decision did not use.
 *
 * Estimates (`worth`, `est`) are already floored to a multiple of 10, and every comparison the decision
 * makes is against that floored figure (bids and thresholds are multiples of 10, so this is exact).
 */
export type BidReason =
  /** worth >= next. `boosted`: the ×1.15 "someone already passed" factor is included in `worth`. */
  | { code: 'bid.worth'; next: number; worth: number; boosted: boolean }
  /** next − 10 <= worth < next: a close call worth taking (measured: bidding 10 under the estimate pays). */
  | { code: 'bid.close'; next: number; worth: number; boosted: boolean }
  | { code: 'pass.overMax'; next: number; max: number }
  | { code: 'pass.worth'; next: number; worth: number; boosted: boolean };

export type DecisionReason =
  /** est >= bid. */
  | { code: 'play.enough'; est: number; bid: number }
  /** At 100: 80 <= est < bid. */
  | { code: 'play.close'; est: number; bid: number }
  /** Above 100 with est < bid: a throw costs the same as failing and also pays each opponent `share`. */
  | { code: 'play.noThrow'; est: number; bid: number; share: number }
  /** At 100 with est < 80. */
  | { code: 'throw.free'; est: number; bid: number };

/** Why one hand-out card is the one to give away. */
export type GiveWhy = 'void' | 'zero' | 'low' | 'forced';

export interface HandoutReason {
  code: 'handout';
  gives: Array<{ to: PlayerId; card: Card; why: GiveWhy }>;
  /** Recipient who gets the higher-value card because their score is lower; null when scores tie. */
  betterTo: PlayerId | null;
}

export type CardReason =
  | { code: 'only'; card: Card }
  /** Leading the Q of a held marriage declares it. */
  | { code: 'lead.declare'; card: Card; suit: Suit; points: number }
  /** No trump yet: cash a side ace (it cannot be trumped) before declaring the `marriage`. */
  | { code: 'lead.cashAce'; card: Card; marriage: Suit }
  /** The highest card still out in its suit. */
  | { code: 'lead.top'; card: Card }
  /** Bidder holds the top trump: draw the opponents' trumps with it. */
  | { code: 'lead.drawTrump'; card: Card }
  /** Bidder without the top trump: draw trumps with the lowest one, keep the high ones. */
  | { code: 'lead.lowTrump'; card: Card }
  /** A low card from the longest side suit. */
  | { code: 'lead.probe'; card: Card }
  /** The cheapest card to give the lead away with. */
  | { code: 'lead.cheap'; card: Card }
  /** Cheapest card that beats everything on the table. `last`: nobody plays after this. */
  | { code: 'follow.beat'; card: Card; last: boolean; points: number }
  /** Void in the led suit: the cheapest trump that wins. */
  | { code: 'follow.trump'; card: Card; last: boolean; points: number }
  /** Nothing legal wins: the lowest card. */
  | { code: 'follow.cantWin'; card: Card }
  /** Another opponent (not the bidder) is winning and this card cannot or should not beat it: keep points. */
  | { code: 'follow.keepPoints'; card: Card; winner: PlayerId }
  /** The only legal card that keeps a held marriage (K+Q of `suit`) together. */
  | { code: 'follow.keepMarriage'; card: Card; suit: Suit }
  /** Void in the led suit and not trumping: the least useful card. */
  | { code: 'follow.discard'; card: Card; led: Suit };

export type Reason = BidReason | DecisionReason | HandoutReason | CardReason;

export interface BotChoice {
  action: Action;
  reason: Reason;
}
