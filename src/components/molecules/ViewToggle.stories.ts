import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import ViewToggle from './ViewToggle.vue';

const meta: Meta<typeof ViewToggle> = {
  component: ViewToggle,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ViewToggle>;

export const Grid: Story = {
  args: { modelValue: 'grid' },
  render: (args) => ({
    components: { ViewToggle },
    setup: () => ({ args, value: ref('grid') }),
    template: '<ViewToggle v-model="value" />',
  }),
};

export const List: Story = {
  args: { modelValue: 'list' },
  render: (args) => ({
    components: { ViewToggle },
    setup: () => ({ args, value: ref('list') }),
    template: '<ViewToggle v-model="value" />',
  }),
};
