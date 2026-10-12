import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerView } from '@tysiac/engine';
import { ActionZone, type ActionZoneProps } from './ActionZone';
import { SEATS4, findState, roomInfo, step, viewOf } from '../test/fixtures';

function props(view: PlayerView, over: Partial<ActionZoneProps> = {}): ActionZoneProps {
  return {
    view, room: roomInfo(), idle: true, busy: false, selected: null, given: {}, next: null, hint: null, coach: false, advice: null, note: null, now: 0,
    onAct: vi.fn(), onPlay: vi.fn(), onConfirmHandout: vi.fn(), onSlot: vi.fn(), onBotFor: vi.fn(), onWhy: vi.fn(), ...over,
  };
}
const watching = findState(s => s.phase === 'talon' && s.round!.bid.high !== 'me');
const bidding = findState(s => s.phase === 'talon' && s.round!.bid.high === 'me');

describe('TalonPanel', () => {
  it('a watcher confirms with Seen', async () => {
    const p = props(viewOf(watching));
    render(<ActionZone {...p} />);
    expect(document.querySelector('.zone')!.getAttribute('data-phase')).toBe('talon');
    await userEvent.click(screen.getByRole('button', { name: 'Seen' }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'ackTalon' });
  });

  it('the bidder sees who is still looking', () => {
    render(<ActionZone {...props(viewOf(bidding))} />);
    expect(screen.queryByRole('button', { name: 'Seen' })).toBeNull();
    expect(screen.getByText(/Waiting for Bot Basia and Bot Zenek/)).toBeInTheDocument();
  });

  it('after confirming (or after a reconnect), a watcher waits too', () => {
    const acked = step(watching, 'me', { type: 'ackTalon' }).state;
    expect(acked.phase).toBe('talon');
    render(<ActionZone {...props(viewOf(acked))} />);
    expect(screen.queryByRole('button', { name: 'Seen' })).toBeNull();
    expect(screen.getByText(/Waiting for/)).toBeInTheDocument();
  });

  it('4 players: the sitting-out dealer gets Seen, not the sit-out text', () => {
    const s = findState(st => st.phase === 'talon' && st.round!.dealer === 'me', SEATS4);
    render(<ActionZone {...props(viewOf(s))} />);
    expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument();
    expect(screen.queryByText('You deal and sit out this round.')).toBeNull();
  });

  it('offers a bot for an away watcher after 30 s', async () => {
    const view = viewOf(bidding);
    const away = view.round!.talonWaiting[0];
    const room = roomInfo();
    const i = room.seats.findIndex(x => x?.id === away);
    room.seats[i] = { ...room.seats[i]!, isBot: false, connected: false, awaySince: 0 };
    const early = render(<ActionZone {...props(view, { room, now: 5_000 })} />);
    expect(screen.getByText(/is away/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Let a bot play for/ })).toBeNull();
    early.unmount();
    const p = props(view, { room, now: 31_000 });
    render(<ActionZone {...p} />);
    await userEvent.click(screen.getByRole('button', { name: /Let a bot play for/ }));
    expect(p.onBotFor).toHaveBeenCalledWith(away);
  });
});
