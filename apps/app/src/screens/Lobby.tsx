import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { m } from 'motion/react';
import type { LobbyOp, RoomSeat } from '../net/protocol';
import { useRoom } from '../store/room';
import './lobby.css';

/** Seat k steps clockwise from the viewer (viewer at the bottom), as % of the table box. */
export function seatPosition(k: number, n: number): { left: string; top: string } {
  const angle = ((90 + (k * 360) / n) * Math.PI) / 180;
  const round = (x: number) => Math.round(x * 10) / 10;
  return { left: `${round(50 + 42 * Math.cos(angle))}%`, top: `${round(50 + 38 * Math.sin(angle))}%` };
}

export default function Lobby() {
  const room = useRoom(s => s.room);
  const me = useRoom(s => s.me);
  const [picked, setPicked] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [, navigate] = useLocation();
  if (!room) return null;

  const send = useRoom.getState().send;
  const op = (o: LobbyOp) => send({ t: 'lobby', op: o });
  const isHost = room.hostId === me;
  const n = room.seats.length;
  const myIndex = Math.max(0, room.seats.findIndex(s => s?.id === me));
  const full = room.seats.every(Boolean);
  const pickedSeat = picked === null ? null : room.seats[picked];

  const tapSeat = (i: number) => {
    if (picked === null) return setPicked(i);
    if (picked === i) return setPicked(null);
    op({ op: 'swapSeats', a: picked, b: i });
    setPicked(null);
  };
  const dropOn = (from: number, x: number, y: number) => {
    if (typeof document.elementsFromPoint !== 'function') return;
    const target = document
      .elementsFromPoint(x, y)
      .map(el => el.closest<HTMLElement>('[data-seat-index]'))
      .find(el => el && Number(el.dataset.seatIndex) !== from);
    if (target) op({ op: 'swapSeats', a: from, b: Number(target.dataset.seatIndex) });
  };
  const share = async () => {
    const url = `${window.location.origin}/r/${room.code}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Tysiąc', text: `Join my Tysiąc game (${room.code})`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setNote('Link copied');
    } catch {
      setNote(url);
    }
  };
  const leave = () => {
    send({ t: 'leave' });
    useRoom.getState().detach();
    navigate('/');
  };

  return (
    <main className="screen lobby">
      <header className="lobby__head">
        <button type="button" className="iconbtn" aria-label="Leave" onClick={leave}>
          ←
        </button>
        <div className="lobby__code">
          <small>Room code</small>
          <b className="display">{room.code}</b>
        </div>
      </header>
      <div className="lobby__table">
        <div className="lobby__felt">
          <span className="lobby__arrow">
            <b>↻</b>clockwise
          </span>
        </div>
        {room.seats.map((seat, i) => (
          <SeatButton
            key={seat?.id ?? `empty-${i}`}
            index={i}
            seat={seat}
            pos={seatPosition((i - myIndex + n) % n, n)}
            isMe={seat?.id === me}
            dealer={room.firstDealer === i}
            picked={picked === i}
            onTap={() => tapSeat(i)}
            onDrop={(x, y) => dropOn(i, x, y)}
          />
        ))}
      </div>
      <p className="lobby__hint">
        {picked === null
          ? 'Tap two seats to swap them (or drag) so the order matches where you sit. Play goes clockwise.'
          : 'Now tap another seat to swap.'}
      </p>
      {picked !== null && isHost && (
        <div className="row lobby__picked">
          <button
            type="button"
            className="btn btn--sec"
            onClick={() => {
              op({ op: 'setFirstDealer', seat: picked });
              setPicked(null);
            }}
          >
            Make first dealer
          </button>
          {pickedSeat?.isBot && (
            <button
              type="button"
              className="btn btn--sec"
              onClick={() => {
                op({ op: 'removeBot', playerId: pickedSeat.id });
                setPicked(null);
              }}
            >
              Remove bot
            </button>
          )}
        </div>
      )}
      <div className="lobby__actions">
        <div className="row">
          <button type="button" className="btn btn--sec" onClick={() => void share()}>
            Share link
          </button>
          {isHost && (
            <button type="button" className="btn btn--sec" disabled={full} onClick={() => op({ op: 'addBot' })}>
              Add bot
            </button>
          )}
        </div>
        {note && (
          <p className="lobby__note" role="status">
            {note}
          </p>
        )}
        {isHost ? (
          <button type="button" className="btn btn--pri" disabled={!full} onClick={() => op({ op: 'start' })}>
            Start game
          </button>
        ) : (
          <p className="lobby__note">Waiting for the host to start…</p>
        )}
      </div>
    </main>
  );
}

interface SeatButtonProps {
  index: number;
  seat: RoomSeat | null;
  pos: { left: string; top: string };
  isMe: boolean;
  dealer: boolean;
  picked: boolean;
  onTap(): void;
  onDrop(x: number, y: number): void;
}

function SeatButton({ index, seat, pos, isMe, dealer, picked, onTap, onDrop }: SeatButtonProps) {
  // A drag must not also register as a tap (which would pick the seat afterwards).
  const draggedAt = useRef(0);
  return (
    <m.button
      type="button"
      className={`seat ${picked ? 'seat--picked' : ''} ${seat ? '' : 'seat--empty'}`}
      style={pos}
      data-seat-index={index}
      aria-label={`Seat ${index + 1}: ${seat ? seat.name : 'empty'}`}
      aria-pressed={picked}
      drag={!!seat}
      dragSnapToOrigin
      dragMomentum={false}
      whileDrag={{ scale: 1.12, rotate: -4, zIndex: 5 }}
      onDragEnd={(_, info) => {
        draggedAt.current = Date.now();
        onDrop(info.point.x - window.scrollX, info.point.y - window.scrollY);
      }}
      onClick={() => {
        if (Date.now() - draggedAt.current > 300) onTap();
      }}
    >
      <span className="avatar">
        {seat?.avatar ?? '+'}
        {dealer && <span className="avatar__dealer">D</span>}
      </span>
      <span>{seat ? (isMe ? 'You' : seat.name) : 'Empty'}</span>
      {seat && !seat.isBot && !seat.connected && <span className="badge">away</span>}
    </m.button>
  );
}
