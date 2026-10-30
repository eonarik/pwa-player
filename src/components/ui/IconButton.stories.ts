// src/components/ui/IconButton.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import IconButton from './IconButton.vue';
import IconSettings from '@/components/icons/IconSettings.vue';
import IconX from '@/components/icons/IconX.vue';
import IconPlay from '@/components/icons/IconPlay.vue';

const meta: Meta<typeof IconButton> = {
  title: 'UI/IconButton',
  component: IconButton,
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    variant: { control: 'select', options: ['default', 'ghost', 'danger', 'active'] },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: { size: 'md', variant: 'default', label: 'Настройки' },
  render: (args) => ({
    components: { IconButton, IconSettings },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args"><IconSettings class="h-4 w-4" /></IconButton>',
  }),
};

export const Danger: Story = {
  args: { variant: 'danger', label: 'Удалить' },
  render: (args) => ({
    components: { IconButton, IconX },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args"><IconX class="h-4 w-4" /></IconButton>',
  }),
};

export const Active: Story = {
  args: { variant: 'active', label: 'Играет' },
  render: (args) => ({
    components: { IconButton, IconPlay },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args"><IconPlay class="h-4 w-4" /></IconButton>',
  }),
};

export const Disabled: Story = {
  args: { variant: 'default', label: 'Недоступно', disabled: true },
  render: Default.render,
};
