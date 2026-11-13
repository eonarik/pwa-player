import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Textarea from './Textarea.vue';

const meta: Meta<typeof Textarea> = {
  component: Textarea,
  tags: ['autodocs'],
  args: { modelValue: '', placeholder: 'Введите текст...' },
};

export default meta;

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Textarea v-model="model" v-bind="args" />',
  }),
};

export const Filled: Story = {
  args: { modelValue: 'Многострочный\nтекст с переносами' },
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Textarea v-model="model" v-bind="args" />',
  }),
};

export const Disabled: Story = {
  args: { disabled: true, modelValue: 'Disabled text' },
  render: (args) => ({
    components: { Textarea },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Textarea v-model="model" v-bind="args" />',
  }),
};
