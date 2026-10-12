import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { turnOf, type Advice } from '@tysiac/engine';
import Game from '../screens/Game';
import { useRoom } from '../store/room';
import { useSelection } from '../game/selection';
import { FakeConnection } from '../test/fakes';
import { findState, roomInfo, stateMsg, viewOf, welcomeMsg } from '../test/fixtures';
import { LessonContext } from './context';

beforeEach(() => {
  useRoom.getState().detach();
  useSelection.getState().reset();
});

describe('Game with a LessonContext', () => {
  it('shows the lesson advice on the coach line even when the seat has coach off', () => {
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const card = viewOf(s0).legal.find(a => a.type === 'card')!;
    const advice: Advice = { action: card, headline: 'Lead it now', reasons: ['Because the lesson says so.'] };
    const conn = new FakeConnection();
    useRoom.getState().attach(conn);
    conn.push(welcomeMsg(roomInfo()));
    conn.push(stateMsg(s0));
    render(
      <LessonContext.Provider value={{ advice: () => advice }}>
        <Game />
      </LessonContext.Provider>,
    );
    expect(screen.getByText('Lead it now')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Why?' })).toBeInTheDocument();
  });

  it('without a LessonContext the seat coach flag still rules (coach off → no Coach line)', () => {
    const s0 = findState(s => s.phase === 'tricks' && turnOf(s) === 'me');
    const conn = new FakeConnection();
    useRoom.getState().attach(conn);
    conn.push(welcomeMsg(roomInfo()));
    conn.push(stateMsg(s0));
    render(<Game />);
    expect(screen.queryByText('Coach:')).toBeNull();
  });
});
