import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import AutocompleteInput from './AutocompleteInput.vue';

const meta: Meta<typeof AutocompleteInput> = {
  component: AutocompleteInput,
  tags: ['autodocs'],
  args: { modelValue: '', suggestions: ['Apple', 'Apricot', 'Avocado', 'Banana', 'Blueberry'] },
};

export default meta;

type Story = StoryObj<typeof AutocompleteInput>;

export const Default: Story = {
  render: (args) => ({
    components: { AutocompleteInput },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<AutocompleteInput v-model="model" :suggestions="args.suggestions" />',
  }),
};

export const WithValue: Story = {
  args: { modelValue: 'Apple' },
  render: (args) => ({
    components: { AutocompleteInput },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<AutocompleteInput v-model="model" :suggestions="args.suggestions" />',
  }),
};
