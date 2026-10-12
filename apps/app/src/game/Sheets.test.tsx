import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoundSummary } from '@tysiac/engine';
import { ScoreSheet, zapisRows } from './ScoreSheet';
import { RoundResultSheet, roundHeadline } from './RoundResultSheet';
import { GameOverSheet } from './GameOverSheet';
import { gameStats } from './stats';
import { SEATS, findState, viewOf } from '../test/fixtures';

const mid = viewOf(findState(s => s.rounds.filter(r => r.outcome !== 'thrown').length >= 2, SEATS, 600));
const over = viewOf(findState(s => s.phase === 'gameEnd', SEATS, 5000));

describe('zapisRows', () => {
  it('has one row per round with running totals and the bid in the bidder cell', () => {
    const rows = zapisRows(mid);
    expect(rows).toHaveLength(mid.rounds.length);
    const last = rows.at(-1)!;
    for (const c of last.cells) expect(c.total).toBe(mid.scores[c.id].total);
    rows.forEach((row, i) => {
      const r = mid.rounds[i];
      const bidderCell = row.cells.find(c => c.id === r.bidder)!;
      expect(bidderCell.bid).toBe(r.outcome === 'thrown' ? `${r.bid}✕` : String(r.bid));
      expect(bidderCell.failed).toBe(r.outcome === 'failed');
    });
  });
});

describe('ScoreSheet', () => {
  it('is a closable dialog with every player', async () => {
    const onClose = vi.fn();
    render(<ScoreSheet view={mid} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Score sheet' });
    for (const s of mid.seats) expect(within(dialog).getByText(s.name, { exact: false })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('RoundResultSheet', () => {
  const base: RoundSummary = mid.rounds.find(r => r.outcome !== 'thrown')!;
  const name = base.bidder === 'me' ? 'You' : mid.seats.find(s => s.id === base.bidder)!.name;

  it('headlines made, failed, thrown and wykładana rounds', () => {
    expect(roundHeadline({ ...base, outcome: 'made', wykladana: false }, mid)).toBe(`${name} made ${base.bid}`);
    expect(roundHeadline({ ...base, outcome: 'failed', wykladana: false }, mid)).toBe(`${name} failed ${base.bid}`);
    expect(roundHeadline({ ...base, outcome: 'thrown', wykladana: false }, mid)).toBe(`${name} threw in at ${base.bid}`);
    expect(roundHeadline({ ...base, outcome: 'made', wykladana: true }, mid)).toBe(`${name} won every trick — wykładana!`);
  });

  it('lists every player and continues', async () => {
    const onContinue = vi.fn();
    render(<RoundResultSheet summary={base} view={mid} note="Coach says hi" onContinue={onContinue} />);
    const dialog = screen.getByRole('dialog', { name: `Round ${base.number}` });
    expect(within(dialog).getAllByRole('row')).toHaveLength(base.players.length + 1);
    expect(within(dialog).getByText('Coach says hi')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe('game over', () => {
  it('gameStats sorts by total and counts bids', () => {
    const stats = gameStats(over);
    expect(stats.map(s => s.total)).toEqual([...stats.map(s => s.total)].sort((a, b) => b - a));
    for (const s of stats) {
      const bids = over.rounds.filter(r => r.bidder === s.id && r.outcome !== 'thrown').length;
      expect(s.bidsMade + s.bidsFailed).toBe(bids);
    }
  });

  it('shows the winner; only the host can rematch', async () => {
    const onRematch = vi.fn();
    const { unmount } = render(<GameOverSheet view={over} isHost onRematch={onRematch} onHome={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Game over' });
    const winner = over.winner === 'me' ? 'You win!' : `${over.seats.find(s => s.id === over.winner)!.name} wins!`;
    expect(within(dialog).getByText(`🏆 ${winner}`)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Rematch' }));
    expect(onRematch).toHaveBeenCalledOnce();
    unmount();
    render(<GameOverSheet view={over} isHost={false} onRematch={onRematch} onHome={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull();
    expect(screen.getByText('Waiting for the host to start a rematch…')).toBeInTheDocument();
  });
});
