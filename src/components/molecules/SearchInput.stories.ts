import type { Meta, StoryObj } from '@storybook/vue3';
import SearchInput from './SearchInput.vue';

const meta: Meta<typeof SearchInput> = {
  component: SearchInput,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SearchInput>;

export const Collapsed: Story = {
  args: { placeholder: 'Поиск…' },
  render: (args) => ({
    components: { SearchInput },
    setup: () => ({ args, model: '' }),
    template: '<SearchInput v-model="model" v-bind="args" />',
  }),
};

export const Expanded: Story = {
  args: { placeholder: 'Поиск…' },
  render: (args) => ({
    components: { SearchInput },
    setup: () => ({ args, model: 'Название' }),
    template: '<SearchInput v-model="model" v-bind="args" />',
  }),
};

export const AlwaysOpen: Story = {
  args: { placeholder: 'Поиск в плейлисте…', alwaysOpen: true },
  render: (args) => ({
    components: { SearchInput },
    setup: () => ({ args, model: '' }),
    template: '<SearchInput v-model="model" v-bind="args" />',
  }),
};
