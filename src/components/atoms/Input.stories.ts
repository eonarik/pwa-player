import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Input from './Input.vue';

const meta: Meta<typeof Input> = {
  component: Input,
  tags: ['autodocs'],
  args: { modelValue: '', placeholder: 'Введите текст' },
};

export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => ({
    components: { Input },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Input v-model="model" v-bind="args" />',
  }),
};

export const Filled: Story = {
  args: { modelValue: 'Название трека' },
  render: (args) => ({
    components: { Input },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Input v-model="model" v-bind="args" />',
  }),
};

export const Disabled: Story = {
  args: { disabled: true, modelValue: 'Disabled' },
  render: (args) => ({
    components: { Input },
    setup: () => ({ args, model: ref(args.modelValue) }),
    template: '<Input v-model="model" v-bind="args" />',
  }),
};

export const Types: Story = {
  render: (args) => ({
    components: { Input },
    setup: () => ({ args, model: ref('') }),
    template: `
      <div class="flex flex-col gap-4">
        <Input type="text" placeholder="text" />
        <Input type="password" placeholder="password" />
        <Input type="number" placeholder="number" />
        <Input type="search" placeholder="search" />
      </div>
    `,
  }),
};
