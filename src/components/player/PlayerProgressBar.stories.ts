// src/components/player/PlayerProgressBar.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import PlayerProgressBar from './PlayerProgressBar.vue';

const meta: Meta<typeof PlayerProgressBar> = {
  title: 'Player/PlayerProgressBar',
  component: PlayerProgressBar,
  argTypes: {
    currentTime: { control: 'number' },
    duration: { control: 'number' },
    size: { control: 'select', options: ['sm', 'lg'] },
    interactive: { control: 'boolean' },
    showTime: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof PlayerProgressBar>;

export const Default: Story = {
  args: { currentTime: 45, duration: 180, size: 'sm', interactive: true, showTime: true },
  render: (args) => ({
    components: { PlayerProgressBar },
    setup: () => ({ args }),
    template: '<div class="w-full max-w-md py-6"><PlayerProgressBar v-bind="args" /></div>',
  }),
};

export const Large: Story = {
  args: { ...Default.args, size: 'lg' },
  render: Default.render,
};
