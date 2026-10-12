import { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import RoomRoute from './RoomRoute';
import { setServiceForTests } from '../net/service';
import { usePrefs } from '../store/prefs';
import { useRoom } from '../store/room';
import { FakeService } from '../test/fakes';
import { roomInfo } from '../test/fixtures';
import type { ClientMessage } from '../net/protocol';

let svc: FakeService;
const renderRoute = (code = 'K7QX2M') =>
  render(
    <Suspense fallback={null}>
      <RoomRoute code={code} />
    </Suspense>,
  );
const lobbyOps = (msgs: ClientMessage[]) => msgs.flatMap(m => (m.t === 'lobby' ? [m.op] : []));

beforeEach(() => {
  svc = new FakeService();
  setServiceForTests(svc);
  useRoom.getState().detach();
  usePrefs.setState({ name: 'Filip', avatar: '🦊', lastRoom: null, gamesStarted: 0, coach: null, countedRoom: null });
});
afterEach(() => {
  useRoom.getState().detach();
  setServiceForTests(null);
});

describe('RoomRoute', () => {
  it('asks for a name before joining', async () => {
    const user = userEvent.setup();
    usePrefs.setState({ name: '' });
    renderRoute();
    expect(screen.getByRole('heading', { name: 'Join game K7QX2M' })).toBeInTheDocument();
    expect(svc.conns).toHaveLength(0);
    await user.type(screen.getByLabelText('Your name'), 'Kuba');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    expect(svc.hellos[0]()).toMatchObject({ t: 'hello', v: 1, name: 'Kuba', avatar: '🦊', coach: true });
  });

  it('rejects a malformed code without connecting', () => {
    renderRoute('nope');
    expect(screen.getByRole('heading', { name: 'Bad room code' })).toBeInTheDocument();
    expect(svc.conns).toHaveLength(0);
  });

  it('practice rooms add two bots and start', async () => {
    usePrefs.setState({ lastRoom: { code: 'K7QX2M', practice: true, at: Date.now() } });
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    const conn = svc.conns[0];
    const lobby = roomInfo({ code: 'K7QX2M', status: 'lobby' });
    lobby.seats[1] = null;
    lobby.seats[2] = null;
    conn.push({ t: 'welcome', you: 'me', room: lobby, serverTime: 0 });
    await waitFor(() => expect(lobbyOps(conn.sent)).toEqual([{ op: 'addBot' }, { op: 'addBot' }]));
    const half = roomInfo({ code: 'K7QX2M', status: 'lobby' });
    half.seats[2] = null;
    conn.push({ t: 'room', room: half });
    conn.push({ t: 'room', room: roomInfo({ code: 'K7QX2M', status: 'lobby' }) });
    await waitFor(() => expect(lobbyOps(conn.sent)).toEqual([{ op: 'addBot' }, { op: 'addBot' }, { op: 'start' }]));
    expect(svc.hellos[0]().coach).toBe(true);
  });

  it('shows the lobby for a lobby room', async () => {
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    svc.conns[0].push({ t: 'welcome', you: 'me', room: roomInfo({ code: 'K7QX2M', status: 'lobby' }), serverTime: 0 });
    expect(await screen.findByText('Room code')).toBeInTheDocument();
  });

  it('fatal join errors stop reconnecting and explain', async () => {
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    const conn = svc.conns[0];
    conn.push({ t: 'error', code: 'roomFull', message: 'This room is full' });
    expect(await screen.findByRole('heading', { name: "Can't join" })).toBeInTheDocument();
    expect(screen.getByText('This room is full.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(conn.status).toBe('closed');
  });

  it('shows a reconnecting banner', async () => {
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    svc.conns[0].push({ t: 'welcome', you: 'me', room: roomInfo({ code: 'K7QX2M', status: 'lobby' }), serverTime: 0 });
    svc.conns[0].setStatus('reconnecting');
    expect(await screen.findByText('Reconnecting…')).toBeInTheDocument();
  });

  it('replaced close shows "Opened in another tab" and Use here reconnects', async () => {
    const user = userEvent.setup();
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    svc.conns[0].closeReason = 'replaced';
    svc.conns[0].setStatus('closed');
    expect(await screen.findByRole('heading', { name: 'Opened in another tab' })).toBeInTheDocument();
    expect(svc.conns).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Use here' }));
    await waitFor(() => expect(svc.conns).toHaveLength(2));
  });

  it('protocol and rejected closes show a message with Home and do not reconnect', async () => {
    renderRoute();
    await waitFor(() => expect(svc.conns).toHaveLength(1));
    svc.conns[0].closeReason = 'rejected';
    svc.conns[0].setStatus('closed');
    expect(await screen.findByRole('heading', { name: 'Connection closed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(svc.conns).toHaveLength(1);
  });

  it('a service that cannot load offers Retry', async () => {
    const user = userEvent.setup();
    const real = svc.connect.bind(svc);
    let fail = true;
    svc.connect = (c, h) => {
      if (fail) throw new Error('boom');
      return real(c, h);
    };
    renderRoute();
    expect(await screen.findByRole('heading', { name: "Can't reach the server" })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(svc.conns).toHaveLength(1));
  });
});
