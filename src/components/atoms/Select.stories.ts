import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Select from './Select.vue';

const options = [
  { value: 'a', label: 'Первый' },
  { value: 'b', label: 'Второй' },
  { value: 'c', label: 'Третий' },
];

const meta: Meta<typeof Select> = {
  component: Select,
  tags: ['autodocs'],
  args: { modelValue: '', options },
};

export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: (args) => ({
    components: { Select },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Select v-model="value" :options="args.options" />',
  }),
};

export const Disabled: Story = {
  render: (args) => ({
    components: { Select },
    setup: () => ({ args, value: ref('a') }),
    template: '<Select v-model="value" :options="args.options" :disabled="args.disabled" />',
  }),
};
