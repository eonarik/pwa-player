// src/components/ui/Spinner.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import Spinner from './Spinner.vue';

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: { size: 'md', text: 'Загрузка...' },
};
