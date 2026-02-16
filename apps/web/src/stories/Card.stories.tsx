import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardPlaceholder, MiniCard } from '@/components/game/Card';
import { FeltDecorator } from './decorators';
import type { Card as CardType, Suit, Rank } from '@tysiac/shared';

const meta: Meta<typeof Card> = {
  title: 'Game/Card',
  component: Card,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    isSelected: { control: 'boolean' },
    isPlayable: { control: 'boolean' },
    isFaceDown: { control: 'boolean' },
    isMarriageCard: { control: 'boolean' },
    isTrumpCard: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

const aceOfHearts: CardType = { suit: 'hearts', rank: 'A' };
const kingOfSpades: CardType = { suit: 'spades', rank: 'K' };
const queenOfDiamonds: CardType = { suit: 'diamonds', rank: 'Q' };
const jackOfClubs: CardType = { suit: 'clubs', rank: 'J' };
const tenOfHearts: CardType = { suit: 'hearts', rank: '10' };
const nineOfSpades: CardType = { suit: 'spades', rank: '9' };

export const AceOfHearts: Story = {
  args: { card: aceOfHearts, size: 'lg', isPlayable: true },
};

export const KingOfSpades: Story = {
  args: { card: kingOfSpades, size: 'lg', isPlayable: true },
};

export const QueenOfDiamonds: Story = {
  args: { card: queenOfDiamonds, size: 'lg', isPlayable: true },
};

export const JackOfClubs: Story = {
  args: { card: jackOfClubs, size: 'lg', isPlayable: true },
};

export const Selected: Story = {
  args: { card: aceOfHearts, size: 'lg', isSelected: true, isPlayable: true },
};

export const NotPlayable: Story = {
  args: { card: tenOfHearts, size: 'lg', isPlayable: false, onClick: () => {} },
};

export const FaceDown: Story = {
  args: { card: aceOfHearts, size: 'lg', isFaceDown: true },
};

export const MarriageCard: Story = {
  args: { card: kingOfSpades, size: 'lg', isMarriageCard: true, isPlayable: true },
};

export const TrumpCard: Story = {
  args: { card: tenOfHearts, size: 'lg', isTrumpCard: true, isPlayable: true },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Card card={aceOfHearts} size={size} isPlayable={false} />
          <span className="text-white/60 text-xs">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const AllSuits: Story = {
  render: () => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    return (
      <div className="flex gap-3">
        {suits.map((suit) => (
          <Card key={suit} card={{ suit, rank: 'A' }} size="lg" isPlayable={false} />
        ))}
      </div>
    );
  },
};

export const AllRanks: Story = {
  render: () => {
    const ranks: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A'];
    return (
      <div className="flex gap-2">
        {ranks.map((rank) => (
          <Card key={rank} card={{ suit: 'hearts', rank }} size="md" isPlayable={false} />
        ))}
      </div>
    );
  },
};

export const FaceCards: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-3">
      {(['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]).map((suit) => (
        ['K', 'Q', 'J'].map((rank) => (
          <Card key={`${suit}-${rank}`} card={{ suit, rank: rank as Rank }} size="lg" isPlayable={false} />
        ))
      ))}
    </div>
  ),
};

export const SpecialStates: Story = {
  render: () => (
    <div className="flex gap-4 items-end">
      <div className="flex flex-col items-center gap-2">
        <Card card={kingOfSpades} size="lg" isPlayable={true} />
        <span className="text-white/60 text-xs">Playable</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Card card={kingOfSpades} size="lg" isSelected={true} isPlayable={true} />
        <span className="text-white/60 text-xs">Selected</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Card card={kingOfSpades} size="lg" isMarriageCard={true} isPlayable={true} />
        <span className="text-white/60 text-xs">Marriage</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Card card={tenOfHearts} size="lg" isTrumpCard={true} isPlayable={true} />
        <span className="text-white/60 text-xs">Trump</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Card card={aceOfHearts} size="lg" isFaceDown={true} />
        <span className="text-white/60 text-xs">Face Down</span>
      </div>
    </div>
  ),
};

export const Placeholder: Story = {
  render: () => (
    <div className="flex gap-3">
      <CardPlaceholder size="sm" />
      <CardPlaceholder size="md" />
      <CardPlaceholder size="lg" />
    </div>
  ),
};

export const MiniCards: Story = {
  render: () => (
    <div className="flex gap-2 bg-table-800/90 p-3 rounded-lg">
      <MiniCard card={aceOfHearts} />
      <MiniCard card={kingOfSpades} />
      <MiniCard card={queenOfDiamonds} />
      <MiniCard card={jackOfClubs} />
      <MiniCard card={tenOfHearts} />
      <MiniCard card={nineOfSpades} />
    </div>
  ),
};
