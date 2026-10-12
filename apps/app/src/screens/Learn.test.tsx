import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Learn from './Learn';
import { LocalRoom } from '../net/localRoom';
import { usePrefs } from '../store/prefs';
import { useRoom } from '../store/room';

beforeEach(() => {
  useRoom.getState().detach();
  usePrefs.setState({ name: 'Ola', avatar: '🦊', coach: null, lastRoom: null, gamesStarted: 0, countedRoom: null });
});
afterEach(() => {
  useRoom.getState().detach();
  vi.restoreAllMocks();
});

describe('Learn screen', () => {
  it('asks for a name first', () => {
    usePrefs.setState({ name: '' });
    render(<Learn />);
    expect(screen.getByRole('heading', { name: 'Learn to play' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });

  it('opens with Welcome, then Card values after Next', async () => {
    const user = userEvent.setup();
    render(<Learn />);
    expect(await screen.findByRole('dialog', { name: 'Welcome to Tysiąc' }, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('dialog', { name: 'Card values' })).toBeInTheDocument();
    expect(screen.getByText(/A = 11/)).toBeInTheDocument();
  });

  it('bots wait while an explanation is open', async () => {
    render(<Learn />);
    await screen.findByRole('dialog', { name: 'Welcome to Tysiąc' }, { timeout: 5000 });
    const seq = useRoom.getState().view!.seq;
    await new Promise(r => setTimeout(r, 1500));
    expect(useRoom.getState().view!.seq).toBe(seq);
  });

  it('unmounting disposes the lesson room; a new mount starts at Welcome', async () => {
    const user = userEvent.setup();
    const dispose = vi.spyOn(LocalRoom.prototype, 'dispose');
    const first = render(<Learn />);
    await screen.findByRole('dialog', { name: 'Welcome to Tysiąc' }, { timeout: 5000 });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('dialog', { name: 'Card values' });
    first.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(useRoom.getState().conn).toBeNull());
    render(<Learn />);
    expect(await screen.findByRole('dialog', { name: 'Welcome to Tysiąc' }, { timeout: 5000 })).toBeInTheDocument();
  });
});
