import type { GameEvent, PlayerId, PlayerView, RoundSummary } from '../types';
import { roundToTen } from '../scoring';
import { msg, type EngineMsg } from '../messages';

const pl = (p: PlayerId) => ({ player: p });

/** One short message explaining an event to `view.me`, or null if it needs no explanation. */
export function explainEvent(event: GameEvent, view: PlayerView): EngineMsg | null {
  const mine = 'p' in event && event.p === view.me;
  switch (event.type) {
    case 'marriage': {
      const params = { suit: { suit: event.suit }, points: event.points };
      return mine ? msg('event.marriage.you', params) : msg('event.marriage', { ...params, player: pl(event.p) });
    }
    case 'trickWon':
      if (!event.byTrump) return null;
      return mine
        ? msg('event.trumpWin.you', { card: { card: event.card } })
        : msg('event.trumpWin', { player: pl(event.p), card: { card: event.card } });
    case 'biddingWon':
      if (event.talonPublic) {
        return mine
          ? msg('event.bidWon.public.you', { amount: event.amount })
          : msg('event.bidWon.public', { player: pl(event.p), amount: event.amount });
      }
      return mine
        ? msg('event.bidWon.private.you', { amount: event.amount })
        : msg('event.bidWon.private', { player: pl(event.p), amount: event.amount });
    case 'threw':
      return explainThrow(event.summary, event.amount, view);
    case 'wykladana':
      return mine ? msg('event.wykladana.you') : msg('event.wykladana', { player: pl(event.p) });
    case 'roundScored':
      return explainRound(event.summary, view);
    case 'gameWon':
      return mine
        ? msg('event.gameWon.you', { total: event.totals[event.p] })
        : msg('event.gameWon', { player: pl(event.p), total: event.totals[event.p] });
    default:
      return null;
  }
}

/** Throw-in text built from the real score changes (barrel players and a sitting-out dealer get 0). */
function explainThrow(summary: RoundSummary, amount: number, view: PlayerView): EngineMsg {
  const you = summary.bidder === view.me;
  if (summary.players.every(p => p.scoreChange === 0)) {
    return you ? msg('event.threw.nobody.you', { amount }) : msg('event.threw.nobody', { player: pl(summary.bidder), amount });
  }
  const changes = {
    list: summary.players.map(p => ({
      msgs: [
        p.playerId === view.me
          ? msg('event.change.you', { delta: { signed: p.scoreChange } })
          : msg('event.change', { player: pl(p.playerId), delta: { signed: p.scoreChange } }),
      ],
    })),
  };
  return you
    ? msg('event.threw.changes.you', { amount, changes })
    : msg('event.threw.changes', { player: pl(summary.bidder), amount, changes });
}

function explainRound(summary: RoundSummary, view: PlayerView): EngineMsg {
  if (summary.outcome === 'thrown') return explainThrow(summary, summary.bid, view);
  const bidder = summary.players.find(p => p.playerId === summary.bidder)!;
  const you = summary.bidder === view.me;
  const player = pl(summary.bidder);
  const nums = { bid: summary.bid, scored: bidder.totalRoundPoints };
  const parts: EngineMsg[] = [];
  if (summary.outcome === 'made') {
    const p = { ...nums, change: bidder.scoreChange };
    if (roundToTen(bidder.totalRoundPoints) !== bidder.totalRoundPoints) {
      parts.push(you ? msg('round.made.rounded.you', p) : msg('round.made.rounded', { ...p, player }));
    } else parts.push(you ? msg('round.made.you', p) : msg('round.made', { ...p, player }));
  } else if (roundToTen(bidder.totalRoundPoints) >= summary.bid) {
    // A near miss that would round up to the bid still fails: rounding never helps the bidder.
    parts.push(you ? msg('round.failed.near.you', nums) : msg('round.failed.near', { ...nums, player }));
  } else parts.push(you ? msg('round.failed.you', nums) : msg('round.failed', { ...nums, player }));
  if (bidder.fellOffBarrel) parts.push(you ? msg('round.fellOff.you') : msg('round.fellOff', { player }));
  const me = summary.players.find(p => p.playerId === view.me);
  if (me && !you) {
    if (me.wasOnBarrel) parts.push(msg('round.youBarrel'));
    else if (me.sittingOut) parts.push(msg('round.youSatOut', { n: me.scoreChange }));
    else parts.push(msg('round.you', { n: me.scoreChange }));
  }
  return msg('round.summary', { parts: { msgs: parts } });
}
