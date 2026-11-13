import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Toggle from './Toggle.vue';

const meta: Meta<typeof Toggle> = {
  component: Toggle,
  tags: ['autodocs'],
  args: { modelValue: false },
};

export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  render: (args) => ({
    components: { Toggle },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Toggle v-model="value" :disabled="args.disabled" />',
  }),
};

export const On: Story = {
  args: { modelValue: true },
  render: (args) => ({
    components: { Toggle },
    setup: () => ({ args, value: ref(args.modelValue) }),
    template: '<Toggle v-model="value" />',
  }),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { Toggle },
    setup: () => ({ args, value: ref(false) }),
    template: '<Toggle v-model="value" :disabled="args.disabled" />',
  }),
};
