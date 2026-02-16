import type { Meta, StoryObj } from '@storybook/react';
import { RoomBrowser } from '@/components/lobby/RoomBrowser';
import { FeltDecoratorCompact } from './decorators';
import type { Room } from '@tysiac/shared';

const meta: Meta<typeof RoomBrowser> = {
  title: 'Lobby/RoomBrowser',
  component: RoomBrowser,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof RoomBrowser>;

const mockRooms: Room[] = [
  {
    id: 'r1', code: 'ABC123', name: 'Friday Night Cards', hostId: 'h1',
    players: [
      { id: 'h1', name: 'Jan', isReady: true, isHost: true, isAI: false },
      { id: 'p2', name: 'Kasia', isReady: false, isHost: false, isAI: false },
    ],
    maxPlayers: 3, isPrivate: false, gameId: null, createdAt: Date.now(),
  },
  {
    id: 'r2', code: 'XYZ789', name: "Marek's Table", hostId: 'h2',
    players: [
      { id: 'h2', name: 'Marek', isReady: true, isHost: true, isAI: false },
      { id: 'p3', name: 'Anna', isReady: true, isHost: false, isAI: false },
      { id: 'p4', name: 'Bot', isReady: true, isHost: false, isAI: true },
    ],
    maxPlayers: 3, isPrivate: false, gameId: null, createdAt: Date.now(),
  },
  {
    id: 'r3', code: 'PRI456', name: 'Private Game', hostId: 'h3',
    players: [
      { id: 'h3', name: 'Tomek', isReady: true, isHost: true, isAI: false },
    ],
    maxPlayers: 4, isPrivate: true, gameId: null, createdAt: Date.now(),
  },
];

export const WithRooms: Story = {
  render: () => (
    <div className="w-[400px] h-[500px]">
      <RoomBrowser publicRooms={mockRooms} onJoin={() => {}} isConnected />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="w-[400px] h-[500px]">
      <RoomBrowser publicRooms={[]} onJoin={() => {}} isConnected />
    </div>
  ),
};

export const FullRoom: Story = {
  render: () => (
    <div className="w-[400px] h-[500px]">
      <RoomBrowser
        publicRooms={[mockRooms[1]]} // 3/3 players
        onJoin={() => {}}
        isConnected
      />
    </div>
  ),
};
