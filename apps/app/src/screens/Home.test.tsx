import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Home from './Home';
import { setServiceForTests } from '../net/service';
import { usePrefs } from '../store/prefs';
import { FakeService } from '../test/fakes';

let svc: FakeService;
beforeEach(() => {
  svc = new FakeService();
  setServiceForTests(svc);
  usePrefs.setState({ name: 'Filip', avatar: '🦊', lastRoom: null, gamesStarted: 0, coach: null });
});
afterEach(() => setServiceForTests(null));

describe('Home', () => {
  it('first launch asks for a name and avatar', async () => {
    const user = userEvent.setup();
    usePrefs.setState({ name: '' });
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Tysiąc' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your name'), 'Ola');
    await user.click(screen.getByRole('button', { name: 'Avatar 🦉' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(usePrefs.getState()).toMatchObject({ name: 'Ola', avatar: '🦉' });
    expect(screen.getByRole('button', { name: 'Practice vs bots' })).toBeInTheDocument();
  });

  it('Practice vs bots creates a 3-player practice room and opens it', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole('button', { name: 'Practice vs bots' }));
    await waitFor(() => expect(window.location.pathname).toBe('/r/K7QX2M'));
    expect(svc.created[0]).toMatchObject({ maxPlayers: 3, name: 'Filip', avatar: '🦊' });
    expect(usePrefs.getState().lastRoom).toMatchObject({ code: 'K7QX2M', practice: true });
  });

  it('New game for 4 players is not a practice room', async () => {
    const user = userEvent.setup();
    render(<Home />);
    await user.click(screen.getByRole('button', { name: '4 players' }));
    await waitFor(() => expect(svc.created).toHaveLength(1));
    expect(svc.created[0].maxPlayers).toBe(4);
    expect(usePrefs.getState().lastRoom).toMatchObject({ practice: false });
  });

  it('Join validates the code and checks the room exists', async () => {
    const user = userEvent.setup();
    render(<Home />);
    const input = screen.getByLabelText('Join with code');
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(screen.getByRole('alert')).toHaveTextContent('A room code has 6 letters or digits.');
    await user.clear(input);
    await user.type(input, 'zzzzzz');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    expect(await screen.findByText('No room with code ZZZZZZ.')).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, 'k7qx2m');
    await user.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(window.location.pathname).toBe('/r/K7QX2M'));
  });

  it('offers to resume a recent unfinished room', async () => {
    const user = userEvent.setup();
    svc.exists.K7QX2M = { exists: true, status: 'playing', maxPlayers: 3, seatsTaken: 3 };
    usePrefs.setState({ lastRoom: { code: 'K7QX2M', practice: false, at: Date.now() } });
    render(<Home />);
    await user.click(await screen.findByRole('button', { name: 'Resume' }));
    expect(window.location.pathname).toBe('/r/K7QX2M');
  });

  it('does not offer to resume a finished room', async () => {
    svc.exists.K7QX2M = { exists: true, status: 'finished', maxPlayers: 3, seatsTaken: 3 };
    usePrefs.setState({ lastRoom: { code: 'K7QX2M', practice: false, at: Date.now() } });
    render(<Home />);
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('network failures say so and offer Retry', async () => {
    const user = userEvent.setup();
    const err = Object.assign(new Error('x'), { kind: 'network' });
    let fail = true;
    svc.createRoom = async () => {
      if (fail) throw err;
      return { code: 'K7QX2M' };
    };
    render(<Home />);
    await user.click(screen.getByRole('button', { name: '4 players' }));
    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(window.location.pathname).toBe('/r/K7QX2M'));
  });
});
