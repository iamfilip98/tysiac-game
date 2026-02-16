import type { Meta, StoryObj } from '@storybook/react';
import { SettingsDropdown } from '@/components/game/SettingsDropdown';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof SettingsDropdown> = {
  title: 'Game/SettingsDropdown',
  component: SettingsDropdown,
  decorators: [(Story) => (
    <FeltDecoratorCompact>
      <div className="flex justify-end w-[300px]">
        <Story />
      </div>
    </FeltDecoratorCompact>
  )],
};

export default meta;
type Story = StoryObj<typeof SettingsDropdown>;

export const Default: Story = {};
