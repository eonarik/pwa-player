import type { Meta, StoryObj } from '@storybook/vue3';
import Label from './Label.vue';

const meta: Meta<typeof Label> = {
  component: Label,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: { text: 'Название' },
  render: (args) => ({
    components: { Label },
    setup: () => ({ args }),
    template: '<Label v-bind="args" />',
  }),
};

export const Slot: Story = {
  render: () => ({
    components: { Label },
    template: '<Label>Текст из слота</Label>',
  }),
};
