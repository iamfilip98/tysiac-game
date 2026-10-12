import type { Action, PlayerId, PlayerView } from '@tysiac/engine';
import type { RoomInfo } from '../net/protocol';
import { who } from '../store/notes';
import { WaitLine, isAway } from './panels';
import { currentLang } from '../i18n';
import { useT } from '../i18n/useT';

export interface TalonPanelProps {
  view: PlayerView;
  room: RoomInfo | null;
  now: number;
  busy: boolean;
  idle: boolean;
  onAct(a: Action): void;
  onBotFor(p: PlayerId): void;
}

const names = (view: PlayerView, ids: PlayerId[]) =>
  new Intl.ListFormat(currentLang(), { type: 'conjunction' }).format(ids.map(p => who(view, p)));

/** Public talon: watchers confirm with Seen; the bidder (and anyone done) sees who is still looking. */
export function TalonPanel({ view, room, now, busy, idle, onAct, onBotFor }: TalonPanelProps) {
  const t = useT();
  const r = view.round!;
  const bidder = r.bid.high;
  const you = bidder === view.me;
  const mustAck = view.legal.some(a => a.type === 'ackTalon');
  const waiting = r.talonWaiting.filter(p => p !== view.me);
  return (
    <>
      <div className="lbl">{t(you ? 'game.talon.title.you' : 'game.talon.title', { player: who(view, bidder), amount: r.bid.amount })}</div>
      {mustAck ? (
        <>
          <p className="zone__text">{t(you ? 'game.talon.goTo.you' : 'game.talon.goTo', { player: who(view, bidder) })}</p>
          <div className="zone__buttons">
            <button type="button" className="btn btn--pri" disabled={busy || !idle} onClick={() => onAct({ type: 'ackTalon' })}>
              {t('game.talon.seen')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="zone__text">{t('game.talon.waiting', { names: names(view, waiting) })}</p>
          {waiting
            .filter(p => isAway(room?.seats.find(x => x?.id === p)))
            .map(p => (
              <WaitLine key={p} who={p} view={view} room={room} now={now} busy={busy} onBotFor={onBotFor} />
            ))}
        </>
      )}
    </>
  );
}
