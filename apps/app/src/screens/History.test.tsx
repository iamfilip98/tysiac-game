import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import History from './History';
import { getIdentity } from '../net/identity';
import type { HistoryResponse } from '../net/protocol';
import { loadLang } from '../i18n';

const me = () => getIdentity().playerId;
function data(): HistoryResponse {
  return {
    games: [
      {
        id: 'g1', finishedAt: Date.UTC(2026, 9, 10, 20, 0), playerCount: 3, winnerId: me(),
        players: [
          { id: me(), name: 'Ola', avatar: '🦊', isBot: false, finalScore: 1010, won: true },
          { id: 'k', name: 'Kuba', avatar: '🐻', isBot: false, finalScore: 640, won: false },
          { id: 'bot-1', name: 'Bot Basia', avatar: '🤖', isBot: true, finalScore: 300, won: false },
        ],
      },
      {
        id: 'g2', finishedAt: Date.UTC(2026, 9, 9, 20, 0), playerCount: 3, winnerId: 'k',
        players: [
          { id: me(), name: 'Ola', avatar: '🦊', isBot: false, finalScore: 700, won: false },
          { id: 'k', name: 'Kuba', avatar: '🐻', isBot: false, finalScore: 1020, won: true },
          { id: 'z', name: 'Zosia', avatar: '🦉', isBot: false, finalScore: 500, won: false },
        ],
      },
    ],
    headToHead: [{ opponentId: 'k', name: 'Kuba', avatar: '🐻', games: 4, wins: 3, losses: 1 }],
    leaderboard: [
      { playerId: me(), name: 'Ola', avatar: '🦊', games: 4, wins: 3 },
      { playerId: 'k', name: 'Kuba', avatar: '🐻', games: 4, wins: 1 },
    ],
  };
}
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('History screen', () => {
  it('History in Polish', async () => {
    await loadLang('pl');
    vi.stubGlobal('fetch', vi.fn(async () => respond(data())));
    render(<History />);
    expect(screen.getByRole('heading', { name: 'Historia' })).toBeInTheDocument();
    expect(await screen.findByText('Twoja wygrana')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Ranking' })).toBeInTheDocument();
  });

  it('lists recent games with the winner and marks your result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respond(data())));
    render(<History />);
    expect(await screen.findByText('You won')).toBeInTheDocument();
    expect(screen.getByText('Kuba won')).toBeInTheDocument();
    expect(screen.getAllByText(/with bots/)).toHaveLength(1);
  });

  it('Head-to-head shows wins and losses per opponent', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => respond(data())));
    render(<History />);
    await screen.findByText('You won');
    await user.click(screen.getByRole('radio', { name: 'Head-to-head' }));
    expect(screen.getByText('3 W · 1 L · 4 games')).toBeInTheDocument();
  });

  it('Leaderboard shows games, wins and win % and says bot games do not count', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => respond(data())));
    render(<History />);
    await screen.findByText('You won');
    await user.click(screen.getByRole('radio', { name: 'Leaderboard' }));
    expect(screen.getByText('4 games · 3 wins · 75%')).toBeInTheDocument();
    expect(screen.getByText("Games with bots don't count here.")).toBeInTheDocument();
  });

  it('an empty history says so on every tab', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => respond({ games: [], headToHead: [], leaderboard: [] })));
    render(<History />);
    expect(await screen.findByText('No finished games yet. Play one with friends!')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Head-to-head' }));
    expect(screen.getByText('No games against friends yet.')).toBeInTheDocument();
  });

  it('network error, 500 and malformed bodies show an error with Retry', async () => {
    const user = userEvent.setup();
    const f = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(respond({ error: 'x' }, 500))
      .mockResolvedValueOnce(respond({ nope: true }))
      .mockResolvedValueOnce(respond(data()));
    vi.stubGlobal('fetch', f);
    render(<History />);
    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Server error (HTTP 500)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Unexpected response from the server.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('You won')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toHaveFocus();
    expect(f).toHaveBeenCalledTimes(4);
  });

  it('in local practice mode it explains instead of fetching', () => {
    sessionStorage.setItem('tysiac.local', '1');
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    render(<History />);
    expect(screen.getByText(/History is kept for online games only/)).toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });
});
