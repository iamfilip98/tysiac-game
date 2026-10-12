/**
 * Every sentence the coach's advice can show: one template per key, with {named} params.
 * Params arrive display-ready (card labels like 10♠, suit symbols, seat names, numbers).
 * Headline keys mirror the bot's reason codes (bot/reasons.ts); `why.*` keys are supporting lines.
 */
export const COACH_MESSAGES = {
  // bidding
  'bid.worth': 'Bid {next} — this hand looks worth about {worth}',
  'bid.close': 'Bid {next} — this hand looks worth about {worth}, close enough to try',
  'pass.overMax': "Pass — you can't bid above {max}",
  'pass.worth': 'Pass — this hand looks worth about {worth}, short of {next}',
  'why.maxBid': 'Your max bid is {max} (120 + marriages in hand)',
  'why.marriageBid': 'K+Q {suit} marriage: +{points} when you lead the Q and win a trick',
  'why.ace': '1 ace — 11 points and usually a trick',
  'why.aces': '{count} aces — 11 points each and usually a trick',
  'why.talon': 'The talon adds 3 unseen cards — the estimate counts roughly 10 points from it',
  'why.boosted': 'Someone already passed, so the estimate is raised a little (×1.15)',
  'why.closeBid': 'Bidding up to 10 above the estimate pays off over many hands — the winner takes the talon',
  // play or throw
  'play.enough': 'Play — this hand looks worth about {est}, enough for {bid}',
  'play.close': 'Play — about {est} is close to {bid}, and good tricks can make up the rest',
  'play.noThrow': 'Play — throwing in at {bid} costs {bid} too, and gives each opponent {share}',
  'throw.free': "Throw in — it's free at 100 and this hand looks worth only about {est}",
  'throw.freeNothing': "Throw in — it's free at 100 and this hand looks nearly worthless",
  'play.noThrowBarrel': 'Play — throwing in costs {bid} too, and opponents on the barrel get nothing',
  'play.noThrowOne': 'Play — throwing in costs {bid} too, and gives {name} {share} ({barrel} is on the barrel)',
  'why.estimate': 'This hand looks worth about {est}',
  'why.throwFree': 'Throwing at 100 costs nothing: the cards are simply dealt again',
  'why.throwCost': 'Throwing costs you {bid} and gives each opponent {share} (0 if on the barrel)',
  'why.failCost': 'Playing and falling short costs {bid}',
  'why.marriageWorth': 'Your K+Q {suit} marriage is worth {points}',
  'why.voidTrump': "You're void in {suits} — you can discard or trump when it is led",
  'why.voidNoTrump': "You're void in {suits} — you can throw away low cards or trump once a marriage sets a trump suit",
  // hand-out
  'handout.two': 'Give {card1} to {name1} and {card2} to {name2}',
  'handout.one': 'Give {card} to {name}',
  'handout.confirm': 'Hand out {card1} to {name1} and {card2} to {name2} — good choice',
  'handout.confirmNeutral': 'Confirm: {card1} to {name1} and {card2} to {name2}',
  'warn.marriage': 'Giving away {card} breaks your {suit} marriage — better to give {better}',
  'warn.points': 'Giving away {card} hands an opponent {points} points — better to give {better}',
  'give.voidTrump': 'Giving {card} leaves you void in {suit} — you can discard or trump when it is led',
  'give.voidNoTrump': 'Giving {card} leaves you void in {suit} — you can throw away low cards or trump once a marriage sets a trump suit',
  'give.zero': '{card} is worth 0 points',
  'give.low': '{card} is worth only {points} points',
  'give.forced': 'Every other card is worth more to you than {card}',
  'why.keepMarriages': 'Keep your K+Q pairs — each one is a marriage',
  'why.keepAces': 'Keep your aces — they win tricks',
  'why.keepLoneKQ': "Don't give away a lone K or Q — it could complete an opponent's marriage",
  'why.betterTo': 'The better card goes to {name}, who has the lower score',
  // leading
  'lead.declare': 'Lead {card} to declare your {suit} marriage',
  'why.declare': 'Leading a Q with its K in hand declares the marriage: +{points}',
  'why.declareTrump': '{suit} become trumps straight away — even for this trick',
  'why.declareTrick': 'Marriage points only count if you win at least one trick',
  'lead.cashAce': 'Lead {card} — cash your aces while there are no trumps, then declare',
  'why.cashAce': 'With no trump suit yet nobody can beat {card}, and winning keeps you on lead',
  'why.cashAceThen': 'Your {suit} marriage (+{points}) can wait until your next lead',
  'lead.top': 'Lead {card} — the highest {suit} left, a likely winner',
  'why.top': 'No higher {suit} is still out — only a trump can beat it',
  'why.topSafe': 'No higher {suit} is still out',
  'lead.drawTrump': "Lead {card} — your top trump draws out the opponents' trumps",
  'why.drawTrump': 'Every trump they lose now is one that cannot beat your other cards later',
  'lead.lowTrump': 'Lead {card} — draw trumps with a low one and keep your high trumps',
  'why.lowTrump': 'A higher trump is still out, so a high trump led now could be beaten',
  'lead.probe': 'Lead {card} — a low card from your longest suit',
  'why.probe': 'It gives little away and wears down the suit for your later cards',
  'lead.cheap': 'Lead {card} — a low card to give up the lead',
  'why.cheap': '{card} is worth {points} points, so losing it costs little',
  'why.cheapest': 'Every other card you could lead risks more',
  'why.noTrumpLead': "Don't lead trumps as a defender — the bidder usually holds most of them",
  // following
  'play': 'Play {card}',
  'lead.only': 'Lead {card}',
  'why.only': "It's your only legal card",
  'why.noSuit': 'You have no {suit}, so any card is allowed',
  'why.mustBeat': 'As first to respond you must beat {card} if you can',
  'why.followOnly': 'You only need to follow suit — only the first player to respond must beat the lead',
  'follow.takes': '{card} takes the trick ({points} points)',
  'follow.beats': '{card} beats everything played so far',
  'why.trumps': 'Trumps ({suit}) beat every other suit',
  'follow.cantWin': "You can't win this one, so play your lowest card",
  'follow.keepPoints': "{name} is winning — don't add points to an opponent's trick: play your lowest card",
  'follow.keepMarriage': '{card} is the only legal card that keeps your {suit} marriage together',
  'follow.discard': 'Throw away your least useful card — keep aces, trumps and marriages',
  'why.breaksMarriage': 'This gives up your {suit} marriage: it only counts when you lead the Q',
  'why.breaksMarriageForced':
    'This gives up your {suit} marriage: it only counts when you lead the Q — and every legal card here is part of a marriage',
} as const;

export type CoachMessageKey = keyof typeof COACH_MESSAGES;

/** The `{name}` placeholders of a template string, as a union. */
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Placeholders<Rest> : never;
/** The params a template needs: one entry per placeholder, so a missing one fails typecheck. */
export type CoachParams<K extends CoachMessageKey = CoachMessageKey> = {
  [P in Placeholders<(typeof COACH_MESSAGES)[K]>]: string | number;
};
type SayArgs<K extends CoachMessageKey> = [Placeholders<(typeof COACH_MESSAGES)[K]>] extends [never]
  ? [params?: Record<string, never>]
  : [params: CoachParams<K>];

const strict = (): boolean => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return !!env?.VITEST;
};

/**
 * Fills a coach template. A missing param is a type error; if one slips through anyway it throws under test
 * (so a broken template can't ship silently) but renders "…" in production so the UI never crashes.
 */
export function say<K extends CoachMessageKey>(key: K, ...args: SayArgs<K>): string {
  const params = (args[0] ?? {}) as Record<string, string | number>;
  return COACH_MESSAGES[key].replace(/\{(\w+)\}/g, (_, name: string) => {
    if (!(name in params)) {
      if (strict()) throw new Error(`coach message ${key}: missing {${name}}`);
      return '…';
    }
    return String(params[name]);
  });
}
