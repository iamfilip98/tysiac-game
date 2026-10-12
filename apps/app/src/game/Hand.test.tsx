import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cardKey, parseCards, type Card } from '@tysiac/engine';
import { Hand } from './Hand';
import { CardFace, SUIT_TEXT } from './Card';
import { glowFor, marriageTag, sortHand } from './cards';

const cards = parseCards('9S KH 10D QH AS');
const labels = () => within(screen.getByRole('group', { name: 'Your hand' })).getAllByRole('button').map(b => b.getAttribute('aria-label'));

function renderHand(over: Partial<Parameters<typeof Hand>[0]> = {}) {
  const onTap = vi.fn<(c: Card) => void>();
  render(<Hand cards={cards} selected={null} isPlayable={() => true} recommended={null} declared={[]} trump={null} fresh={null} shake={null} onTap={onTap} {...over} />);
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
    const tag = screen.getByText('♥\uFE0E 100');
    expect(tag).toHaveAttribute('data-marriage', 'hearts');
    expect(tag).toHaveStyle({ '--i': '2', '--span': '2' });
    expect(tag.closest('.hand__card')).toBeNull();
    expect(tag).not.toHaveClass('hand__mtag--up');
    expect(marriageTag(cards[1], cards, ['hearts'])).toBeNull();
    expect(marriageTag(cards[3], cards, [])).toBeNull();
  });

  it('the marriage pill rides up with a raised K or Q and never takes taps', () => {
    renderHand({ selected: cardKey(cards[3]) });
    expect(screen.getByText('♥\uFE0E 100')).toHaveClass('hand__mtag--up');
    expect(screen.getByText('♥\uFE0E 100')).toHaveAttribute('aria-hidden', 'true');
  });

  it('declared marriages get no pill', () => {
    renderHand({ declared: ['hearts'] });
    expect(screen.queryByText('♥\uFE0E 100')).toBeNull();
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

describe('CardFace', () => {
  it('draws a top-left index, a mirrored bottom-right index and a centre suit', () => {
    const { container } = render(
      <span className="card">
        <CardFace card={{ suit: 'hearts', rank: 'Q' }} />
      </span>,
    );
    const idx = container.querySelectorAll('.card__idx');
    expect(idx).toHaveLength(2);
    expect(idx[1]).toHaveClass('card__idx--br');
    expect(idx[0].textContent).toBe(`Q${SUIT_TEXT.hearts}`);
    expect(container.querySelector('.card__pip')?.textContent).toBe(SUIT_TEXT.hearts);
  });

  it('uses text-presentation suit glyphs (never emoji)', () => {
    for (const s of Object.values(SUIT_TEXT)) expect(s.endsWith('\uFE0E')).toBe(true);
  });
});

describe('card glows', () => {
  const hand = parseCards('KH QH 9H AS 10D');
  it('gold on both K and Q of an undeclared marriage, beating trump blue', () => {
    expect(glowFor(hand[0], hand, [], 'hearts')).toBe('marriage');
    expect(glowFor(hand[1], hand, [], null)).toBe('marriage');
    expect(glowFor(hand[1], hand, ['hearts'], 'hearts')).toBe('trump');
  });
  it('blue on trumps, nothing otherwise', () => {
    expect(glowFor(hand[2], hand, [], 'hearts')).toBe('trump');
    expect(glowFor(hand[3], hand, [], 'hearts')).toBeNull();
    expect(glowFor(hand[2], hand, [], null)).toBeNull();
  });
  it('renders the glow classes', () => {
    render(<Hand cards={hand} selected={null} isPlayable={() => true} recommended={null} declared={[]} trump="diamonds" fresh={null} shake={null} onTap={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'K♥' })).toHaveClass('card--glow-marriage');
    expect(screen.getByRole('button', { name: '10♦' })).toHaveClass('card--glow-trump');
  });
});

describe('received card', () => {
  it('highlights the freshly received card', () => {
    renderHand({ fresh: cardKey(cards[1]) });
    expect(screen.getByRole('button', { name: 'K♥' })).toHaveClass('card--fresh');
  });
});
