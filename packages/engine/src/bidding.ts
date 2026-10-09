import type { Card, PlayerId } from './types';
import { RULES } from './rules';
import { totalMarriageValue } from './cards';
import type { ValidationResult } from './tricks';

/** Max bid = 120 + total value of marriages in hand. */
export function maxBidFor(hand: Card[]): number {
  return RULES.maxBidBase + totalMarriageValue(hand);
}

/** Bids must be exactly currentBid + 10 and not above maxBidFor(hand). */
export function validateBid(amount: number, currentBid: number, hand: Card[]): ValidationResult {
  const requiredBid = currentBid + RULES.bidStep;
  if (amount !== requiredBid) {
    return { isValid: false, reason: `Bid must be exactly ${requiredBid} (current bid + 10)` };
  }
  const marriageValue = totalMarriageValue(hand);
  const maxBid = RULES.maxBidBase + marriageValue;
  if (amount > maxBid) {
    return { isValid: false, reason: `Maximum bid is ${maxBid} (120 + ${marriageValue} from marriages)` };
  }
  return { isValid: true };
}

/** Next active player clockwise after `current` who has not passed and is not the high bidder. */
export function nextBidder(
  active: PlayerId[],
  current: PlayerId,
  high: PlayerId,
  passed: PlayerId[],
): PlayerId | null {
  const start = active.indexOf(current);
  for (let k = 1; k <= active.length; k++) {
    const candidate = active[(start + k) % active.length];
    if (candidate !== high && !passed.includes(candidate)) return candidate;
  }
  return null;
}
