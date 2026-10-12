import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cardKey, parseCards, type Card } from '@tysiac/engine';
import { Hand } from './Hand';
import { marriageTag, sortHand } from './cards';

const cards = parseCards('9S KH 10D QH AS');
const labels = () => within(screen.getByRole('group', { name: 'Your hand' })).getAllByRole('button').map(b => b.getAttribute('aria-label'));

function renderHand(over: Partial<Parameters<typeof Hand>[0]> = {}) {
  const onTap = vi.fn<(c: Card) => void>();
  render(<Hand cards={cards} selected={null} isPlayable={() => true} recommended={null} declared={[]} shake={null} onTap={onTap} {...over} />);
  return onTap;
}

describe('Hand', () => {
  it('sorts ♠ ♥ ♣ ♦ and by strength, one labelled button per card', () => {
    renderHand();
    expect(labels()).toEqual(['A♠', '9♠', 'K♥', 'Q♥', '10♦']);
  });

  it('dims unplayable cards and raises the selected card', () => {
    renderHand({ selected: cardKey(cards[2]), isPlayable: c => c.suit !== 'spades' });
    expect(screen.getByRole('button', { name: 'A♠' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: '10♦' })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: '10♦' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'K♥' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('tags the king of an undeclared marriage only', () => {
    renderHand();
    expect(screen.getByText('♥ 100')).toBeInTheDocument();
    expect(marriageTag(cards[1], cards, ['hearts'])).toBeNull();
    expect(marriageTag(cards[3], cards, [])).toBeNull();
  });

  it('only reports taps', async () => {
    const onTap = renderHand();
    await userEvent.click(screen.getByRole('button', { name: '10♦' }));
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith({ rank: '10', suit: 'diamonds' });
  });

  it('exposes the card count for the CSS layout', () => {
    renderHand();
    expect(screen.getByRole('group', { name: 'Your hand' }).style.getPropertyValue('--n')).toBe('5');
  });

  it('sortHand does not mutate its input', () => {
    const copy = [...cards];
    sortHand(cards);
    expect(cards).toEqual(copy);
  });
});
