import { type Card, type PlayerId, type PlayerView } from '@tysiac/engine';
import type { RoomInfo, RoomSeat } from '../net/protocol';
import { CardBack, MiniCard } from './Card';
import { opponentIds } from './seating';
import { BARREL, bidChip, onBarrel, passChip, pts } from './format';
import { cardText } from '../i18n/engineText';
import { useT } from '../i18n/useT';

export function chipFor(view: PlayerView, id: PlayerId): { text: string; muted: boolean } | null {
  const r = view.round;
  if (!r || r.sittingOut === id) return null;
  if (view.phase === 'bidding') {
    if (r.bid.passed.includes(id)) return { text: passChip(), muted: true };
    return r.bid.high === id ? { text: bidChip(r.bid.amount), muted: false } : null;
  }
  return r.bid.high === id ? { text: bidChip(r.bid.amount), muted: false } : null;
}

export interface OpponentsProps {
  view: PlayerView;
  room: RoomInfo | null;
  given?: Partial<Record<PlayerId, Card>>;
  targetable?: boolean;
  onTarget?(p: PlayerId): void;
  onUngive?(p: PlayerId): void;
}

export function Opponents({ view, room, given = {}, targetable = false, onTarget, onUngive }: OpponentsProps) {
  useT();
  const ids = opponentIds(view.seats.map(s => s.id), view.me);
  return (
    <div className="opps" data-count={ids.length}>
      {ids.map(id => (
        <Opponent
          key={id}
          id={id}
          view={view}
          seat={room?.seats.find((s): s is RoomSeat => s?.id === id) ?? null}
          given={given[id] ?? null}
          targetable={targetable}
          onTarget={onTarget}
          onUngive={onUngive}
        />
      ))}
    </div>
  );
}

interface OpponentProps {
  id: PlayerId;
  view: PlayerView;
  seat: RoomSeat | null;
  given: Card | null;
  targetable: boolean;
  onTarget?(p: PlayerId): void;
  onUngive?(p: PlayerId): void;
}

function Opponent({ id, view, seat, given, targetable, onTarget, onUngive }: OpponentProps) {
  const t = useT();
  const s = view.seats.find(x => x.id === id)!;
  const r = view.round;
  const sittingOut = r?.sittingOut === id;
  const count = r?.handCounts[id] ?? 0;
  const chip = chipFor(view, id);
  const total = view.scores[id]?.total ?? 0;
  const away = seat !== null && !seat.isBot && !seat.connected;
  const inTalon = view.phase === 'talon' && r !== null && id !== r.bid.high;
  const looking = inTalon && r.talonWaiting.includes(id);
  const seen = inTalon && !looking;
  const cls = `opp ${view.turn === id && !view.paused ? 'opp--turn' : ''} ${targetable && !given && !sittingOut ? 'opp--target' : ''}`;
  const body = (
    <>
      <span className="avatar">
        {s.avatar}
        {r?.dealer === id && <span className="avatar__dealer" title={t('game.opp.dealer')}>{t('game.opp.dealerMark')}</span>}
      </span>
      <span className="opp__name">
        {s.name}
        {seat?.coach && <span role="img" aria-label={t('game.opp.coach')}> 🎓</span>}
      </span>
      <span className="opp__meta">
        <span className="opp__score" aria-label={t('game.opp.score', { points: pts(total) })}>
          {pts(total)}
          {onBarrel(total) && (
            <span className="opp__barrel" role="img" aria-label={t('game.opp.barrel')}>
              {' '}
              {BARREL}
            </span>
          )}
        </span>
        {chip && <span className={`chip ${chip.muted ? 'chip--muted' : ''}`}>{chip.text}</span>}
      </span>
      {sittingOut ? (
        <span className="opp__out">{t('game.opp.sitsOut')}</span>
      ) : (
        <span className="backs" role="img" aria-label={t('game.opp.cards', { n: count })}>
          {Array.from({ length: count }, (_, i) => (
            <CardBack key={i} size="mini" />
          ))}
        </span>
      )}
      {seen && <span className="badge badge--ok">{t('game.opp.seen')}</span>}
      {looking && <span className="badge badge--looking">{t('game.opp.looking')}</span>}
      {away && <span className="badge">{seat.botFor ? t('game.opp.botPlaying') : t('game.opp.away')}</span>}
    </>
  );
  if (targetable && !given && !sittingOut) {
    return (
      <button type="button" className={cls} data-seat={id} aria-label={t('game.opp.giveTo', { name: s.name })} onClick={() => onTarget?.(id)}>
        {body}
      </button>
    );
  }
  return (
    <div className={cls} data-seat={id}>
      {body}
      {given && (
        <span className="opp__given">
          {t('game.opp.gets')} <MiniCard card={given} />
          <button type="button" className="iconbtn opp__ungive" aria-label={t('game.opp.takeBack', { card: cardText(given) })} onClick={() => onUngive?.(id)}>
            ✕
          </button>
        </span>
      )}
    </div>
  );
}
