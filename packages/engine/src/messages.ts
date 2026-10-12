import type { Card, PlayerId, Suit } from './types';

/**
 * Every message the engine can return, as a key plus the names of its params. The engine never builds
 * sentences: the app renders `{ key, params }` in the player's language (apps/app/src/i18n/<lang>/engine.ts,
 * where each template must use exactly these placeholders — checked at compile time).
 *
 * Keys ending in `.you` are the same message with the viewer as the subject (verb forms differ by language),
 * so a `{player}` param never stands for "you" as a subject.
 */
export const ENGINE_MSG_PARAMS = {
  // reduce(): why an action was rejected
  'reject.unknownAction': [],
  'reject.notSeated': [],
  'reject.gameOver': [],
  'reject.paused': [],
  'reject.notPaused': [],
  'reject.cantPause': [],
  'reject.nothingToConfirm': [],
  'reject.waitTalon': [],
  'reject.notYourTurn': [],
  'reject.cantPlayCard': [],
  'reject.invalidBid': [],
  'reject.badHandout': [],
  'reject.notAllowed': [],
  'reject.unhandled': [],
  // why a card can't be played (explainIllegal / cardRuleMessage)
  'illegal.paused': [],
  'illegal.notNow': [],
  'illegal.waitFor': ['player'],
  'illegal.notInHand': [],
  'illegal.mustFollow': ['suit'],
  'illegal.mustBeat': ['card'],
  // tricks.ts / bidding.ts helpers
  'trick.byTrump': ['card'],
  'trick.highestTrump': ['card'],
  'trick.highestLead': ['card'],
  'valid.marriageNotLeading': [],
  'valid.marriageAlready': [],
  'valid.marriageNone': [],
  'valid.notInHand': [],
  'valid.invalidCard': [],
  'bid.exact': ['amount'],
  'bid.max': ['max', 'marriages'],
  // coach: event explanations (coach/explain.ts)
  'event.marriage': ['player', 'suit', 'points'],
  'event.marriage.you': ['suit', 'points'],
  'event.trumpWin': ['player', 'card'],
  'event.trumpWin.you': ['card'],
  'event.bidWon.public': ['player', 'amount'],
  'event.bidWon.public.you': ['amount'],
  'event.bidWon.private': ['player', 'amount'],
  'event.bidWon.private.you': ['amount'],
  'event.threw.nobody': ['player', 'amount'],
  'event.threw.nobody.you': ['amount'],
  'event.threw.changes': ['player', 'amount', 'changes'],
  'event.threw.changes.you': ['amount', 'changes'],
  'event.change': ['player', 'delta'],
  'event.change.you': ['delta'],
  'event.wykladana': ['player'],
  'event.wykladana.you': [],
  'event.gameWon': ['player', 'total'],
  'event.gameWon.you': ['total'],
  'round.summary': ['parts'],
  'round.made': ['player', 'bid', 'scored', 'change'],
  'round.made.you': ['bid', 'scored', 'change'],
  'round.made.rounded': ['player', 'bid', 'scored', 'change'],
  'round.made.rounded.you': ['bid', 'scored', 'change'],
  'round.failed': ['player', 'bid', 'scored'],
  'round.failed.you': ['bid', 'scored'],
  'round.failed.near': ['player', 'bid', 'scored'],
  'round.failed.near.you': ['bid', 'scored'],
  'round.fellOff': ['player'],
  'round.fellOff.you': [],
  'round.youBarrel': [],
  'round.youSatOut': ['n'],
  'round.you': ['n'],
  // coach advice (coach/advise.ts). Headline keys mirror the bot's reason codes (bot/reasons.ts).
  'coach.bid.worth': ['next', 'worth'],
  'coach.bid.close': ['next', 'worth'],
  'coach.pass.overMax': ['max'],
  'coach.pass.worth': ['next', 'worth'],
  'coach.why.maxBid': ['max'],
  'coach.why.marriageBid': ['suit', 'points'],
  'coach.why.ace': [],
  'coach.why.aces': ['n'],
  'coach.why.talon': [],
  'coach.why.boosted': [],
  'coach.why.closeBid': [],
  'coach.play.enough': ['est', 'bid'],
  'coach.play.close': ['est', 'bid'],
  'coach.play.noThrow': ['bid', 'share'],
  'coach.throw.free': ['est'],
  'coach.throw.freeNothing': [],
  'coach.play.noThrowBarrel': ['bid'],
  'coach.play.noThrowOne': ['bid', 'player', 'share', 'barrel'],
  'coach.why.estimate': ['est'],
  'coach.why.throwFree': [],
  'coach.why.throwCost': ['bid', 'share'],
  'coach.why.failCost': ['bid'],
  'coach.why.marriageWorth': ['suit', 'points'],
  'coach.why.voidTrump': ['suits'],
  'coach.why.voidNoTrump': ['suits'],
  'coach.handout.two': ['card1', 'player1', 'card2', 'player2'],
  'coach.handout.one': ['card', 'player'],
  'coach.handout.confirm': ['card1', 'player1', 'card2', 'player2'],
  'coach.handout.confirmNeutral': ['card1', 'player1', 'card2', 'player2'],
  'coach.warn.marriage': ['card', 'suit', 'better'],
  'coach.warn.points': ['card', 'points', 'better'],
  'coach.give.voidTrump': ['card', 'suit'],
  'coach.give.voidNoTrump': ['card', 'suit'],
  'coach.give.zero': ['card'],
  'coach.give.low': ['card', 'points'],
  'coach.give.forced': ['card'],
  'coach.why.keepMarriages': [],
  'coach.why.keepAces': [],
  'coach.why.keepLoneKQ': [],
  'coach.why.betterTo': ['player'],
  'coach.lead.declare': ['card', 'suit'],
  'coach.why.declare': ['points'],
  'coach.why.declareTrump': ['suit'],
  'coach.why.declareTrick': [],
  'coach.lead.cashAce': ['card'],
  'coach.why.cashAce': ['card'],
  'coach.why.cashAceThen': ['suit', 'points'],
  'coach.lead.top': ['card', 'suit'],
  'coach.why.top': ['suit'],
  'coach.why.topSafe': ['suit'],
  'coach.lead.drawTrump': ['card'],
  'coach.why.drawTrump': [],
  'coach.lead.lowTrump': ['card'],
  'coach.why.lowTrump': [],
  'coach.lead.probe': ['card'],
  'coach.why.probe': [],
  'coach.lead.cheap': ['card'],
  'coach.why.cheap': ['card', 'points'],
  'coach.why.cheapest': [],
  'coach.why.noTrumpLead': [],
  'coach.play': ['card'],
  'coach.lead.only': ['card'],
  'coach.why.only': [],
  'coach.why.noSuit': ['suit'],
  'coach.why.mustBeat': ['card'],
  'coach.why.followOnly': [],
  'coach.follow.takes': ['card', 'points'],
  'coach.follow.beats': ['card'],
  'coach.why.trumps': ['suit'],
  'coach.follow.cantWin': [],
  'coach.follow.keepPoints': ['player'],
  'coach.follow.keepMarriage': ['card', 'suit'],
  'coach.follow.discard': [],
  'coach.why.breaksMarriage': ['suit'],
  'coach.why.breaksMarriageForced': ['suit'],
} as const satisfies Record<string, readonly string[]>;

export type EngineMsgKey = keyof typeof ENGINE_MSG_PARAMS;
export const ENGINE_MSG_KEYS = Object.keys(ENGINE_MSG_PARAMS) as EngineMsgKey[];
/** The param names of a key, as a union (never for a key without params). */
export type EngineMsgParamName<K extends EngineMsgKey> = (typeof ENGINE_MSG_PARAMS)[K][number];

/**
 * A message param. The app renders each kind in the viewer's language: a card with localised rank letters,
 * a suit as its glyph, a player as their seat name ("you" for the viewer), a signed number as +n / −n,
 * `and` as "a, b and c", `list` as "a, b, c", and `msgs` as sentences joined by a space.
 */
export type MsgParam =
  | string
  | number
  | { card: Card }
  | { suit: Suit }
  | { player: PlayerId }
  | { signed: number }
  | { and: MsgParam[] }
  | { list: MsgParam[] }
  | { msgs: EngineMsg[] };

export interface EngineMsg {
  key: EngineMsgKey;
  params?: Record<string, MsgParam>;
}

type MsgArgs<K extends EngineMsgKey> = [EngineMsgParamName<K>] extends [never]
  ? []
  : [params: { [P in EngineMsgParamName<K>]: MsgParam }];

/** Builds a message. Every param the key declares is required (a missing or extra one fails typecheck). */
export function msg<K extends EngineMsgKey>(key: K, ...args: MsgArgs<K>): EngineMsg {
  const params = args[0] as Record<string, MsgParam> | undefined;
  return params ? { key, params } : { key };
}
