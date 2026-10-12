import { useEffect, useRef } from 'react';
import { useRoom } from '../store/room';

/** Practice rooms: the host fills empty seats with bots and starts as soon as the table is full. */
export function usePracticeAutostart(enabled: boolean): void {
  const room = useRoom(s => s.room);
  const me = useRoom(s => s.me);
  const asked = useRef(0);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || !room || room.status !== 'lobby' || room.hostId !== me) return;
    const send = useRoom.getState().send;
    const missing = room.seats.filter(s => s === null).length;
    if (missing > 0) {
      if (asked.current < room.maxPlayers - 1) {
        for (let i = 0; i < missing; i++) send({ t: 'lobby', op: { op: 'addBot' } });
        asked.current += missing;
      }
      return;
    }
    if (!started.current) {
      started.current = true;
      send({ t: 'lobby', op: { op: 'start' } });
    }
  }, [enabled, room, me]);
}
