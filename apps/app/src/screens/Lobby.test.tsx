import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Lobby, { seatPosition } from './Lobby';
import { useRoom } from '../store/room';
import { FakeConnection } from '../test/fakes';
import { roomInfo } from '../test/fixtures';
import type { ClientMessage, RoomInfo } from '../net/protocol';
import { loadLang } from '../i18n';

function show(room: RoomInfo, me = 'me'): FakeConnection {
  const conn = new FakeConnection();
  useRoom.getState().attach(conn);
  conn.push({ t: 'welcome', you: me, room, serverTime: 0 });
  render(<Lobby />);
  return conn;
}
const lobbyOps = (conn: FakeConnection) => conn.sent.filter((m): m is Extract<ClientMessage, { t: 'lobby' }> => m.t === 'lobby').map(m => m.op);
const partial = (): RoomInfo => {
  const r = roomInfo({ status: 'lobby' });
  r.seats[2] = null;
  return r;
};

beforeEach(() => useRoom.getState().detach());
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
});

describe('Lobby', () => {
  it('Lobby in Danish', async () => {
    await loadLang('da');
    show(partial());
    expect(screen.getByRole('button', { name: 'Tilføj bot' })).toBeInTheDocument();
    expect(screen.getByText('Rumkode')).toBeInTheDocument();
  });

  it('shows the code and every seat, empty ones too', () => {
    show(partial());
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 1: Filip' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 2: Bot Basia' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seat 3: empty' })).toBeInTheDocument();
  });

  it('tapping two seats swaps them', async () => {
    const user = userEvent.setup();
    const conn = show(partial());
    await user.click(screen.getByRole('button', { name: 'Seat 1: Filip' }));
    expect(screen.getByRole('button', { name: 'Seat 1: Filip' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Seat 3: empty' }));
    expect(lobbyOps(conn)).toEqual([{ op: 'swapSeats', a: 0, b: 2 }]);
  });

  it('the host makes a picked seat the first dealer or removes a bot', async () => {
    const user = userEvent.setup();
    const conn = show(partial());
    await user.click(screen.getByRole('button', { name: 'Seat 2: Bot Basia' }));
    await user.click(screen.getByRole('button', { name: 'Make first dealer' }));
    await user.click(screen.getByRole('button', { name: 'Seat 2: Bot Basia' }));
    await user.click(screen.getByRole('button', { name: 'Remove bot' }));
    expect(lobbyOps(conn)).toEqual([{ op: 'setFirstDealer', seat: 1 }, { op: 'removeBot', playerId: 'b' }]);
  });

  it('the host adds bots and starts once every seat is filled', async () => {
    const user = userEvent.setup();
    const conn = show(partial());
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add bot' }));
    expect(lobbyOps(conn)).toEqual([{ op: 'addBot' }]);
    conn.push({ t: 'room', room: roomInfo({ status: 'lobby' }) });
    expect(await screen.findByRole('button', { name: 'Add bot' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(lobbyOps(conn).at(-1)).toEqual({ op: 'start' });
  });

  it('guests wait for the host', () => {
    show(roomInfo({ status: 'lobby', hostId: 'b' }));
    expect(screen.queryByRole('button', { name: 'Add bot' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
    expect(screen.getByText('Waiting for the host to start…')).toBeInTheDocument();
  });

  it('shares with the share sheet, or copies the link', async () => {
    const user = userEvent.setup();
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    show(partial());
    await user.click(screen.getByRole('button', { name: 'Share link' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: `${window.location.origin}/r/ABCDEF` }));
    Reflect.deleteProperty(navigator, 'share');
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Share link' }));
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/r/ABCDEF`);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('places the viewer at the bottom and goes clockwise', () => {
    expect(seatPosition(0, 3)).toEqual({ left: '50%', top: '88%' });
    const left = seatPosition(1, 3);
    expect(parseFloat(left.left)).toBeLessThan(50);
    const right = seatPosition(2, 3);
    expect(parseFloat(right.left)).toBeGreaterThan(50);
  });
});
