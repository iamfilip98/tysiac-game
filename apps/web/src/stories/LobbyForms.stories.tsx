import type { Meta, StoryObj } from '@storybook/react';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { JoinRoomForm } from '@/components/lobby/JoinRoomForm';
import { FeltDecorator } from './decorators';

const meta: Meta = {
  title: 'Lobby/Forms',
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;

export const CreateRoom: StoryObj = {
  render: () => (
    <div className="w-[400px]">
      <CreateRoomForm onSubmit={() => {}} isConnected />
    </div>
  ),
};

export const CreateRoomDisconnected: StoryObj = {
  render: () => (
    <div className="w-[400px]">
      <CreateRoomForm onSubmit={() => {}} isConnected={false} />
    </div>
  ),
};

export const CreateRoomLoading: StoryObj = {
  render: () => (
    <div className="w-[400px]">
      <CreateRoomForm onSubmit={() => {}} isConnected isLoading />
    </div>
  ),
};

export const JoinRoom: StoryObj = {
  render: () => (
    <div className="w-[400px]">
      <JoinRoomForm onSubmit={() => {}} isConnected />
    </div>
  ),
};

export const JoinRoomWithCode: StoryObj = {
  render: () => (
    <div className="w-[400px]">
      <JoinRoomForm onSubmit={() => {}} isConnected initialCode="ABC123" />
    </div>
  ),
};

export const SideBySide: StoryObj = {
  render: () => (
    <div className="flex gap-6">
      <div className="w-[380px]">
        <CreateRoomForm onSubmit={() => {}} isConnected />
      </div>
      <div className="w-[380px]">
        <JoinRoomForm onSubmit={() => {}} isConnected />
      </div>
    </div>
  ),
};
