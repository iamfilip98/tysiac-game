import type { Msg } from '../types';

/** The Rules sheet: one key per section. Every number comes from RULES as a param. */
export const rules = {
  'rules.cards.title': 'Cards',
  'rules.cards': '24 cards: {ranks} in ♣ ♦ ♥ ♠. Points: {points}, so {total} per round. Strength: {strength}.',
  'rules.marriages.title': 'Marriages',
  'rules.marriages': '{king} + {queen} of one suit: {values}. Lead the {queen} while holding its {king} and the marriage is declared automatically: that suit becomes trump at once. Marriage points count only if you win at least one trick.',
  'rules.dealing.title': 'Dealing',
  'rules.dealing': "{hand} cards each and {talon} to the talon. With 4 players the dealer sits out and scores the talon's marriages plus {ace} per ace in it. A hand under {redeal} points with no marriage means a redeal.",
  'rules.bidding.title': 'Bidding',
  'rules.bidding': 'The player left of the dealer automatically holds {auto}. On your turn, bid exactly {step} more than the current bid, or pass. Your maximum is {base} + your marriages. Bidding ends when two players have passed; the high bidder wins.',
  'rules.talon.title': 'Talon, throw-in and hand-out',
  'rules.talon': 'At {auto} only the bidder sees the talon. When a bid over {auto} wins, everyone sees the talon and confirms with Seen before the bidder goes on. The bidder may throw in: at {auto} nobody scores; above it the bidder loses the bid and the others get {share} each (0 on the barrel). Otherwise the bidder gives one card to each opponent.',
  'rules.tricks.title': 'Tricks',
  'rules.tricks': "The bidder leads first. Everyone must follow suit if they can. Only the first player after the leader must also beat the lead card if able. If you can't follow suit, play anything: there is no obligation to trump. A trump beats every other suit.",
  'rules.scoring.title': 'Scoring',
  'rules.scoring': 'Points round to the nearest 10 (a remainder of {up} or more rounds up: {downEx} becomes 100, {upEx} becomes 110). The bidder needs at least the bid in raw points and then scores their points rounded; otherwise the bidder scores minus the bid. Defenders score their own points rounded. On the barrel ({barrel}–{last}) defenders score 0: you only score as the bidder. There is no limit on barrel attempts. First to {win} wins.',
} as const satisfies Record<string, Msg>;
