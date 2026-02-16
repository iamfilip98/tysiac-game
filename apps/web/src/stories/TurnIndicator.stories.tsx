import type { Meta, StoryObj } from '@storybook/react';
import { TurnIndicator, PhaseIndicator } from '@/components/game/TurnIndicator';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof TurnIndicator> = {
  title: 'Game/TurnIndicator',
  component: TurnIndicator,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof TurnIndicator>;

export const MyTurnBidding: Story = {
  args: { playerName: 'You', isMyTurn: true, phase: 'bidding' },
};

export const MyTurnPlaying: Story = {
  args: { playerName: 'You', isMyTurn: true, phase: 'trickPlaying' },
};

export const MyTurnDistribution: Story = {
  args: { playerName: 'You', isMyTurn: true, phase: 'talonDistribution' },
};

export const WaitingForOpponent: Story = {
  args: { playerName: 'Alice', isMyTurn: false, phase: 'trickPlaying' },
};

export const PhaseIndicators: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {['idle', 'dealing', 'bidding', 'talonReveal', 'talonDistribution', 'trickPlaying', 'roundScoring', 'gameEnd'].map((phase) => (
        <div key={phase} className="flex items-center gap-4">
          <span className="text-white/40 text-xs font-mono w-32">{phase}</span>
          <PhaseIndicator phase={phase} roundNumber={3} trickNumber={phase === 'trickPlaying' ? 5 : undefined} />
        </div>
      ))}
    </div>
  ),
};
