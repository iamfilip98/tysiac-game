import { textSuits } from './cards';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { cardLabel, createGame, explainIllegal, msg, turnOf, type Action, type PlayerView } from '@tysiac/engine';
import { engineText } from '../i18n/engineText';
import { ActionZone, throwCost, type ActionZoneProps } from './ActionZone';
import { SEATS4, findState, roomInfo, viewOf } from '../test/fixtures';

function props(view: PlayerView, over: Partial<ActionZoneProps> = {}): ActionZoneProps {
  return {
    view, room: roomInfo(), idle: true, busy: false, selected: null, given: {}, hint: null, coach: false, advice: null, note: null, now: 0,
    onAct: vi.fn(), onPlay: vi.fn(), onConfirmHandout: vi.fn(), onBotFor: vi.fn(), onWhy: vi.fn(), ...over,
  };
}
const zone = () => document.querySelector('.zone') as HTMLElement;

const bidMine = viewOf(findState(s => s.phase === 'bidding' && turnOf(s) === 'me' && s.round!.bid.amount < 120));
const bidOther = viewOf(findState(s => s.phase === 'bidding' && turnOf(s) === 'b'));
const decision = viewOf(findState(s => s.phase === 'decision' && turnOf(s) === 'me'));
const handout = viewOf(findState(s => s.phase === 'handout' && turnOf(s) === 'me'));
const tricks = viewOf(findState(s => s.phase === 'tricks' && turnOf(s) === 'me'));

describe('ActionZone: bidding', () => {
  it('shows the current bid, my max, Pass and Bid +10', async () => {
    const p = props(bidMine);
    render(<ActionZone {...p} />);
    const r = bidMine.round!;
    expect(zone().dataset.phase).toBe('bidding');
    expect(screen.getByText(String(r.bid.amount), { exact: false })).toBeInTheDocument();
    expect(screen.getByText(String(r.maxBid))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pass' }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'pass' });
    await userEvent.click(screen.getByRole('button', { name: `Bid ${r.bid.amount + 10}` }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'bid', amount: r.bid.amount + 10 });
  });

  it('hides Bid when the next bid is over my max', () => {
    const legal: Action[] = [{ type: 'pass' }, { type: 'pause' }];
    render(<ActionZone {...props({ ...bidMine, legal })} />);
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Bid / })).toBeNull();
  });

  it('waits while animations play or it is someone else', () => {
    const { unmount } = render(<ActionZone {...props(bidMine, { idle: false })} />);
    expect(zone().dataset.phase).toBe('wait');
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull();
    unmount();
    render(<ActionZone {...props(bidOther)} />);
    expect(screen.getByText('Bot Basia is bidding…')).toBeInTheDocument();
  });
});

describe('ActionZone: away and paused', () => {
  it('counts down, then offers a bot for an away player', async () => {
    const room = roomInfo();
    room.seats[1] = { ...room.seats[1]!, isBot: false, connected: false, awaySince: 100_000 };
    const { unmount } = render(<ActionZone {...props(bidOther, { room, now: 110_000 })} />);
    expect(screen.getByText('Bot Basia is away')).toBeInTheDocument();
    expect(screen.getByText('bot option in 20 s')).toBeInTheDocument();
    unmount();
    const p = props(bidOther, { room, now: 131_000 });
    render(<ActionZone {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Let a bot play for Bot Basia' }));
    expect(p.onBotFor).toHaveBeenCalledWith('b');
  });

  it('paused: anyone can resume', async () => {
    const v: PlayerView = { ...bidOther, paused: { by: 'b', at: 0 }, legal: [{ type: 'resume' }] };
    const p = props(v);
    render(<ActionZone {...p} />);
    expect(zone().dataset.phase).toBe('paused');
    expect(screen.getByText('Bot Basia paused the game.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'resume' });
  });

  it('sitting-out dealer sees a sit-out note and no buttons', () => {
    const g = createGame({ seed: 's4', seats: SEATS4, maxPlayers: 4, firstDealer: 0 });
    const v = viewOf(g);
    expect(v.round!.sittingOut).toBe('me');
    render(<ActionZone {...props(v, { room: roomInfo({}, SEATS4) })} />);
    expect(screen.getByText('You deal and sit out this round.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull();
  });
});

describe('ActionZone: decision', () => {
  it('Play / Throw in with the cost of throwing', async () => {
    const p = props(decision);
    render(<ActionZone {...p} />);
    expect(zone().dataset.phase).toBe('decision');
    expect(screen.getByText(throwCost(decision))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Throw in' }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'throw' });
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(p.onAct).toHaveBeenCalledWith({ type: 'play' });
  });

  it('throwCost at 100 and above', () => {
    const at = (amount: number): PlayerView => ({ ...decision, round: { ...decision.round!, bid: { ...decision.round!.bid, amount } } });
    expect(throwCost(at(100))).toBe('Throw in: nobody scores, new deal.');
    expect(throwCost(at(120))).toBe('Throw in: you −120, others +60 each (0 on the barrel).');
  });
});

describe('ActionZone: hand-out', () => {
  it('counts given cards and enables Confirm when both are chosen', async () => {
    const [x, y] = handout.round!.active.filter(p => p !== 'me');
    const [c1, c2] = handout.round!.hand;
    const { unmount } = render(<ActionZone {...props(handout, { given: { [x]: c1 } })} />);
    expect(screen.getByText('Handing out · 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm hand-out' })).toBeDisabled();
    unmount();
    const p = props(handout, { given: { [x]: c1, [y]: c2 } });
    render(<ActionZone {...p} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm hand-out' }));
    expect(p.onConfirmHandout).toHaveBeenCalledOnce();
  });
});

describe('ActionZone: tricks', () => {
  it('Play is disabled until a card is raised, then names it', async () => {
    const { unmount } = render(<ActionZone {...props(tricks)} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    unmount();
    const card = tricks.round!.hand.find(c => !explainIllegal(tricks, c))!;
    const p = props(tricks, { selected: card, hint: 'You must follow ♦' });
    render(<ActionZone {...p} />);
    expect(screen.getByText('You must follow ♦')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `Play ${textSuits(cardLabel(card))}` }));
    expect(p.onPlay).toHaveBeenCalledWith(card);
  });
});

describe('ActionZone: coach', () => {
  it('shows the advice headline with Why?, or the event note', async () => {
    const advice = { action: { type: 'pass' } as Action, headline: msg('coach.pass.worth', { worth: 20, next: 110 }), reasons: [msg('coach.why.ace')] };
    const p = props(bidMine, { coach: true, advice });
    const { unmount } = render(<ActionZone {...p} />);
    expect(screen.getByText('Pass — this hand looks worth about 20, short of 110')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Why?' }));
    expect(p.onWhy).toHaveBeenCalledOnce();
    unmount();
    const note = msg('event.bidWon.public', { player: { player: 'z' }, amount: 110 });
    render(<ActionZone {...props(bidOther, { coach: true, advice, note })} />);
    expect(screen.queryByText('Pass — this hand looks worth about 20, short of 110')).toBeNull();
    expect(screen.getByText('Bot Zenek won the bid at 110. Over 100, so everyone sees the talon.')).toBeInTheDocument();
  });

  it('without the coach a public note still shows, without "Coach:"', () => {
    render(<ActionZone {...props(bidOther, { note: msg('event.marriage', { player: { player: 'b' }, suit: { suit: 'hearts' }, points: 100 }) })} />);
    expect(screen.getByText(textSuits('Bot Basia declared the ♥ marriage: +100. ♥ are trumps now.'))).toBeInTheDocument();
    expect(screen.queryByText('Coach:')).toBeNull();
  });
});

describe('ActionZone: illegal raised card', () => {
  it('disables Play and shows the engine reason', () => {
    const v = viewOf(findState(s => {
      if (s.phase !== 'tricks' || turnOf(s) !== 'me') return false;
      const w = viewOf(s);
      return w.round!.hand.some(c => explainIllegal(w, c));
    }));
    const illegal = v.round!.hand.find(c => explainIllegal(v, c));
    expect(illegal).toBeDefined();
    render(<ActionZone {...props(v, { selected: illegal! })} />);
    expect(screen.getByRole('button', { name: `Play ${textSuits(cardLabel(illegal!))}` })).toBeDisabled();
    expect(screen.getByText(textSuits(engineText(explainIllegal(v, illegal!)!, v)))).toBeInTheDocument();
  });
});

describe('ActionZone: busy', () => {
  it('disables every action button while an action is in flight', () => {
    const card = tricks.round!.hand.find(c => !explainIllegal(tricks, c))!;
    for (const [v, extra] of [[bidMine, {}], [decision, {}], [tricks, { selected: card }]] as const) {
      const { unmount } = render(<ActionZone {...props(v, { busy: true, ...extra })} />);
      for (const b of screen.getAllByRole('button')) if (/^(Pass|Bid|Throw|Play)/.test(b.textContent ?? '')) expect(b).toBeDisabled();
      unmount();
    }
    const paused: PlayerView = { ...bidOther, paused: { by: 'b', at: 0 }, legal: [{ type: 'resume' }] };
    render(<ActionZone {...props(paused, { busy: true })} />);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDisabled();
  });

  it('disables the bot button while busy', () => {
    const room = roomInfo();
    room.seats[1] = { ...room.seats[1]!, isBot: false, connected: false, awaySince: 100_000 };
    render(<ActionZone {...props(bidOther, { room, now: 131_000, busy: true })} />);
    expect(screen.getByRole('button', { name: 'Let a bot play for Bot Basia' })).toBeDisabled();
  });
});
