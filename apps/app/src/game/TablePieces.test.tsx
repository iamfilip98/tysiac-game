import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cardLabel, type PlayerView } from '@tysiac/engine';
import { TopBar } from './TopBar';
import { Opponents, chipFor } from './Opponents';
import { Table } from './Table';
import { findState, roomInfo, viewOf } from '../test/fixtures';

const bidding = viewOf(findState(s => s.phase === 'bidding' && s.round!.bid.passed.length === 1 && s.round!.bid.passed[0] !== 'me'));
const tricks = viewOf(findState(s => s.phase === 'tricks' && s.round!.trick.cards.length === 2 && s.round!.lastTrick !== null));
const decision = viewOf(findState(s => s.phase === 'decision' && s.round!.talonPublic));

describe('TopBar', () => {
  it('shows the round, dealer during bidding, and my score', () => {
    render(<TopBar view={bidding} onMenu={() => {}} onScores={() => {}} />);
    expect(screen.getByText(`Round ${bidding.round!.number}`)).toBeInTheDocument();
    expect(screen.getByText(/deals? · bidding/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Score sheet/ })).toHaveTextContent(String(bidding.scores.me.total));
  });

  it('shows contract and trump after bidding', () => {
    const v: PlayerView = { ...tricks, round: { ...tricks.round!, bid: { ...tricks.round!.bid, high: 'b', amount: 120 }, trump: 'hearts' } };
    render(<TopBar view={v} onMenu={() => {}} onScores={() => {}} />);
    expect(screen.getByText('Bot Basia bid 120 · trump ♥')).toBeInTheDocument();
  });

  it('menu and score buttons call back', async () => {
    const onMenu = vi.fn();
    const onScores = vi.fn();
    render(<TopBar view={bidding} onMenu={onMenu} onScores={onScores} />);
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
    await userEvent.click(screen.getByRole('button', { name: /^Score sheet/ }));
    expect(onMenu).toHaveBeenCalledOnce();
    expect(onScores).toHaveBeenCalledOnce();
  });
});

describe('Opponents', () => {
  it('shows names, scores, card counts and a pass chip', () => {
    render(<Opponents view={bidding} room={roomInfo()} />);
    expect(screen.getByText('Bot Basia')).toBeInTheDocument();
    expect(screen.getByText('Bot Zenek')).toBeInTheDocument();
    expect(chipFor(bidding, bidding.round!.bid.passed[0])).toEqual({ text: 'pass', muted: true });
    expect(screen.getByText('pass')).toBeInTheDocument();
    expect(screen.getAllByLabelText(/\d cards/).length).toBeGreaterThan(0);
  });

  it('labels scores with pts and the bid holder with a bid chip', () => {
    render(<Opponents view={bidding} room={roomInfo()} />);
    expect(screen.getAllByLabelText(/^Score -?\d+ pts$|^Score \u2212\d+ pts$/).length).toBeGreaterThan(0);
    const high = bidding.round!.bid.high;
    if (high && high !== bidding.me) expect(chipFor(bidding, high)?.text).toBe(`bid ${bidding.round!.bid.amount}`);
  });

  it('marks whose turn it is, coach and away players', () => {
    const v: PlayerView = { ...bidding, turn: 'b' };
    const room = roomInfo();
    room.seats[1] = { ...room.seats[1]!, coach: true };
    room.seats[2] = { ...room.seats[2]!, isBot: false, connected: false, awaySince: 1 };
    const { container } = render(<Opponents view={v} room={room} />);
    expect(container.querySelector('[data-seat="b"]')).toHaveClass('opp--turn');
    expect(within(container.querySelector('[data-seat="b"]') as HTMLElement).getByLabelText('coach on')).toBeInTheDocument();
    expect(within(container.querySelector('[data-seat="z"]') as HTMLElement).getByText('away')).toBeInTheDocument();
  });

  it('hand-out: targets are buttons and given cards can be taken back', async () => {
    const onTarget = vi.fn();
    const onUngive = vi.fn();
    render(<Opponents view={bidding} room={roomInfo()} targetable given={{ z: { suit: 'clubs', rank: '9' } }} onTarget={onTarget} onUngive={onUngive} />);
    await userEvent.click(screen.getByRole('button', { name: 'Give to Bot Basia' }));
    expect(onTarget).toHaveBeenCalledWith('b');
    expect(screen.queryByRole('button', { name: 'Give to Bot Zenek' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Take back 9♣' }));
    expect(onUngive).toHaveBeenCalledWith('z');
  });
});

describe('Table', () => {
  it('shows three talon backs while bidding', () => {
    render(<Table view={bidding} pending={null} sweepTo={null} />);
    expect(screen.getByLabelText('Talon').querySelectorAll('.back')).toHaveLength(3);
  });

  it('shows the revealed talon in the decision phase', () => {
    render(<Table view={decision} pending={null} sweepTo={null} />);
    expect(within(screen.getByLabelText('Talon')).getAllByRole('img')).toHaveLength(3);
  });

  it('shows the trick, my pending card and the last trick', () => {
    const pending = tricks.round!.hand[0];
    render(<Table view={tricks} pending={pending} sweepTo={null} />);
    const table = screen.getByRole('region', { name: 'Table' });
    for (const t of tricks.round!.trick.cards) expect(within(table).getAllByRole('img', { name: cardLabel(t.card) }).length).toBeGreaterThan(0);
    expect(table.querySelectorAll('.tcard')).toHaveLength(3);
    expect(table.querySelector('.tcard--me')).not.toBeNull();
    expect(within(screen.getByLabelText('Last trick')).getAllByRole('img')).toHaveLength(3);
  });

  it('does not duplicate a pending card the server trick already has', () => {
    const pending = tricks.round!.trick.cards[0].card;
    render(<Table view={tricks} pending={pending} sweepTo={null} />);
    expect(screen.getByRole('region', { name: 'Table' }).querySelectorAll('.tcard')).toHaveLength(2);
  });
});
