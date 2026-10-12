import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { advise, cardEquals, cardKey, cardLabel, explainIllegal, turnOf, type Action, type Card, type GameState } from '@tysiac/engine';
import Game from './Game';
import { readFileSync } from 'node:fs';
import { useRoom } from '../store/room';
import { textSuits } from '../game/cards';
import { useSelection } from '../game/selection';
import { FakeConnection } from '../test/fakes';
import { findState, roomInfo, stateMsg, viewOf, welcomeMsg } from '../test/fixtures';

function join(s: GameState): FakeConnection {
  const conn = new FakeConnection();
  useRoom.getState().attach(conn);
  conn.push(welcomeMsg());
  conn.push(stateMsg(s));
  return conn;
}
const legalCards = (s: GameState): Card[] => viewOf(s).legal.flatMap(a => (a.type === 'card' ? [a.card] : []));
const hand = () => screen.getByRole('group', { name: 'Your hand' });

beforeEach(() => {
  useRoom.getState().detach();
  useSelection.getState().reset();
});

describe('Game screen: tricks', () => {
  it('shows who gave me which card, big, until dismissed (no timeout)', () => {
    vi.useFakeTimers();
    try {
      join(findState(s => s.phase === 'tricks'));
      render(<Game />);
      act(() => useRoom.setState({ received: { card: { suit: 'hearts', rank: 'Q' }, from: 'b', open: true } }));
      const pill = screen.getByRole('button', { name: /Card received/ });
      expect(pill).toHaveTextContent('Bot Basia');
      expect(pill.getAttribute('aria-label')).toContain('\uFE0E');
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(screen.getByRole('button', { name: /Card received/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a tap on the table area skips the trick hold; a tap on a button does not', () => {
    join(findState(s => s.phase === 'tricks'));
    const real = useRoom.getState().skipHold;
    const skipHold = vi.fn();
    useRoom.setState({ skipHold });
    try {
      const { container } = render(<Game />);
      act(() => { (container.querySelector('main.game') as HTMLElement).click(); });
      expect(skipHold).toHaveBeenCalledTimes(1);
      act(() => { screen.getByRole('button', { name: 'Menu' }).click(); });
      expect(skipHold).toHaveBeenCalledTimes(1);
    } finally {
      useRoom.setState({ skipHold: real });
    }
  });

  it('the received pill is dismissed by a click', () => {
    join(findState(s => s.phase === 'tricks'));
    render(<Game />);
    act(() => useRoom.setState({ received: { card: { suit: 'hearts', rank: 'Q' }, from: 'b', open: true } }));
    act(() => { screen.getByRole('button', { name: /Card received/ }).click(); });
    expect(screen.queryByRole('button', { name: /Card received/ })).toBeNull();
    // Still marked in the hand until it is played or the first trick ends.
    expect(useRoom.getState().received).toMatchObject({ open: false });
  });

  it('shows Your turn on my strip when I must act', () => {
    join(findState(s => s.phase === 'tricks' && turnOf(s) === 'me'));
    render(<Game />);
    expect(screen.getByText('Your turn', { selector: '.selfstrip__turn' })).toBeInTheDocument();
  });


  it('tapping a card only raises it; Play commits and the card moves to the table at once', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = join(s0);
    render(<Game />);
    const label = cardLabel(legalCards(s0)[0]);
    await user.click(within(hand()).getByRole('button', { name: label }));
    expect(within(hand()).getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    expect(conn.acts()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: `Play ${textSuits(label)}` }));
    expect(conn.acts()).toHaveLength(1);
    expect(within(hand()).queryByRole('button', { name: label })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Table' })).getByRole('img', { name: label })).toBeInTheDocument();
  });

  it('double-clicking Play sends one act', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = join(s0);
    render(<Game />);
    const label = cardLabel(legalCards(s0)[0]);
    await user.click(within(hand()).getByRole('button', { name: label }));
    await user.dblClick(screen.getByRole('button', { name: `Play ${textSuits(label)}` }));
    expect(conn.acts()).toHaveLength(1);
  });

  it('tapping an illegal card explains why and does not raise it', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me' && legalCards(s).length < s.round!.hands.me.length);
    const conn = join(s0);
    render(<Game />);
    const illegal = viewOf(s0).round!.hand.find(c => !legalCards(s0).some(l => cardEquals(l, c)))!;
    const button = within(hand()).getByRole('button', { name: cardLabel(illegal) });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(screen.getByText(explainIllegal(viewOf(s0), illegal)!)).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(conn.acts()).toHaveLength(0);
  });

  it('a rejected card comes back to the hand', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = join(s0);
    render(<Game />);
    const label = cardLabel(legalCards(s0)[0]);
    await user.click(within(hand()).getByRole('button', { name: label }));
    await user.click(screen.getByRole('button', { name: `Play ${textSuits(label)}` }));
    conn.push({ t: 'reject', id: conn.acts()[0].id, code: 'illegalCard', message: 'Nope' });
    expect(await within(hand()).findByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.getByText('Nope')).toBeInTheDocument();
  });
});

describe('Game screen: other phases', () => {
  it('bidding: Pass sends a pass', async () => {
    const user = userEvent.setup();
    const conn = join(findState(s => s.phase === 'bidding' && turnOf(s) === 'me'));
    render(<Game />);
    await user.click(screen.getByRole('button', { name: 'Pass' }));
    expect(conn.acts()[0].action).toEqual({ type: 'pass' });
  });

  it('hand-out: tap a card, tap an opponent, take back, then confirm both', async () => {
    const user = userEvent.setup();
    const conn = join(findState(s => s.phase === 'handout' && turnOf(s) === 'me'));
    render(<Game />);
    const first = within(hand()).getAllByRole('button')[0].getAttribute('aria-label')!;
    await user.click(within(hand()).getByRole('button', { name: first }));
    await user.click(screen.getByRole('button', { name: 'Give to Bot Basia' }));
    expect(within(hand()).queryByRole('button', { name: first })).toBeNull();
    await user.click(screen.getByRole('button', { name: `Take back ${first}` }));
    expect(within(hand()).getByRole('button', { name: first })).toBeInTheDocument();

    await user.click(within(hand()).getByRole('button', { name: first }));
    await user.click(screen.getByRole('button', { name: 'Give to Bot Basia' }));
    const second = within(hand()).getAllByRole('button')[0].getAttribute('aria-label')!;
    await user.click(within(hand()).getByRole('button', { name: second }));
    await user.click(screen.getByRole('button', { name: 'Give to Bot Zenek' }));
    await user.click(screen.getByRole('button', { name: 'Confirm hand-out' }));
    const action = conn.acts()[0].action as Extract<Action, { type: 'handout' }>;
    expect(cardLabel(action.to.b)).toBe(first);
    expect(cardLabel(action.to.z)).toBe(second);
  });

  it('menu opens the score sheet and settings without a name field', async () => {
    const user = userEvent.setup();
    join(findState(s => s.phase === 'bidding'));
    render(<Game />);
    await user.click(screen.getByRole('button', { name: /^Score sheet/ }));
    expect(screen.getByRole('dialog', { name: /^Score sheet/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Your name')).toBeNull();
  });
});

const css = readFileSync('src/screens/game.css', 'utf8');

describe('Game screen: fix round 1', () => {
  it('confirming hand-out keeps the cards out of the hand and the chips shown', async () => {
    const user = userEvent.setup();
    const conn = join(findState(s => s.phase === 'handout' && turnOf(s) === 'me'));
    render(<Game />);
    const first = within(hand()).getAllByRole('button')[0].getAttribute('aria-label')!;
    await user.click(within(hand()).getByRole('button', { name: first }));
    await user.click(screen.getByRole('button', { name: 'Give to Bot Basia' }));
    const second = within(hand()).getAllByRole('button')[0].getAttribute('aria-label')!;
    await user.click(within(hand()).getByRole('button', { name: second }));
    await user.click(screen.getByRole('button', { name: 'Give to Bot Zenek' }));
    await user.click(screen.getByRole('button', { name: 'Confirm hand-out' }));
    expect(conn.acts()).toHaveLength(1);
    expect(within(hand()).queryByRole('button', { name: first })).toBeNull();
    expect(within(hand()).queryByRole('button', { name: second })).toBeNull();
    expect(screen.getByRole('button', { name: `Take back ${first}` })).toBeInTheDocument();
    conn.push({ t: 'reject', id: conn.acts()[0].id, code: 'illegal', message: 'Nope' });
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    expect(within(hand()).queryByRole('button', { name: first })).toBeNull();
    expect(screen.getByRole('button', { name: `Take back ${first}` })).toBeInTheDocument();
  });

  it('toggling coach sends setCoach and the room echo takes over', async () => {
    const user = userEvent.setup();
    const conn = join(findState(s => s.phase === 'bidding'));
    render(<Game />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('switch', { name: 'Coach hints' }));
    expect(conn.sent).toContainEqual({ t: 'setCoach', coach: true });
    expect(screen.getByRole('switch', { name: 'Coach hints' })).toHaveAttribute('aria-checked', 'true');
    const room = roomInfo();
    conn.push({ t: 'room', room: { ...room, seats: room.seats.map(x => (x?.id === 'me' ? { ...x, coach: true } : x)) } });
    expect(screen.getByRole('switch', { name: 'Coach hints' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Game screen: coach hand-out hints (D12)', () => {
  const recommendedKeys = () =>
    within(hand()).getAllByRole('button').filter(b => b.classList.contains('card--recommended')).map(b => b.getAttribute('data-card'));

  it('outlines both suggested cards, then only the remaining one with a headline that names it', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'handout' && turnOf(s) === 'me');
    const conn = join(s0);
    const room = roomInfo();
    conn.push({ t: 'room', room: { ...room, seats: room.seats.map(x => (x?.id === 'me' ? { ...x, coach: true } : x)) } });
    render(<Game />);
    const advice = advise(viewOf(s0))!;
    const to = (advice.action as Extract<Action, { type: 'handout' }>).to;
    const [[p1, c1], [p2, c2]] = Object.entries(to);
    const name = (p: string) => (p === 'b' ? 'Bot Basia' : 'Bot Zenek');
    expect(recommendedKeys().sort()).toEqual([cardKey(c1), cardKey(c2)].sort());
    expect(screen.getByText(textSuits(advice.headline))).toBeInTheDocument();

    await user.click(within(hand()).getByRole('button', { name: cardLabel(c1) }));
    await user.click(screen.getByRole('button', { name: `Give to ${name(p1)}` }));
    expect(recommendedKeys()).toEqual([cardKey(c2)]);
    expect(screen.getByText(textSuits(`Give ${cardLabel(c2)} to ${name(p2)}`))).toBeInTheDocument();
  });
});

describe('Game screen: layout and private info', () => {
  it('shows the viewer\'s own dealer marker, score and coach badge in the self strip', () => {
    const s0 = findState(s => s.phase === 'bidding');
    join(s0);
    render(<Game />);
    const strip = screen.getByLabelText('You');
    expect(within(strip).getByLabelText('Your score')).toBeInTheDocument();
    expect(within(strip).queryByText('Dealer') !== null).toBe(s0.round!.dealer === 'me');
  });

  it('tapping a dimmed card shakes it instead of raising it', async () => {
    const user = userEvent.setup();
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me' && legalCards(s).length < s.round!.hands.me.length);
    join(s0);
    render(<Game />);
    const illegal = viewOf(s0).round!.hand.find(c => !legalCards(s0).some(l => cardEquals(l, c)))!;
    await user.click(within(hand()).getByRole('button', { name: cardLabel(illegal) }));
    expect(useRoom.getState().shake).not.toBeNull();
    expect(useSelection.getState().selected).toBeNull();
  });

  it('keeps the page from scrolling and sizes the action zone to its content (CSS sanity)', () => {
    expect(css).not.toContain('--zone-h');
    expect(css).toMatch(/height: var\(--vvh, 100vh\);\s*height: 100dvh;/);
    expect(css).toMatch(/body:has\(\.game\)[^}]*overflow: hidden/);
  });
});
