import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Checkbox from './Checkbox.vue';

const meta: Meta<typeof Checkbox> = {
  component: Checkbox,
  tags: ['autodocs'],
  args: { modelValue: false },
};

export default meta;

type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: { label: 'Опция' },
  render: (args) => ({
    components: { Checkbox },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Checkbox v-model="value" :label="args.label" :disabled="args.disabled" />',
  }),
};

export const Checked: Story = {
  args: { modelValue: true, label: 'Выбрано' },
  render: (args) => ({
    components: { Checkbox },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Checkbox v-model="value" :label="args.label" />',
  }),
};

export const WithDescription: Story = {
  args: { modelValue: false, label: 'Опция', description: 'Описание опции' },
  render: (args) => ({
    components: { Checkbox },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Checkbox v-model="value" :label="args.label" :description="args.description" />',
  }),
};

export const Disabled: Story = {
  args: { disabled: true, label: 'Отключено' },
  render: (args) => ({
    components: { Checkbox },
    setup: () => ({ args, value: ref(false) }),
    template: '<Checkbox v-model="value" :label="args.label" :disabled="args.disabled" />',
  }),
};
