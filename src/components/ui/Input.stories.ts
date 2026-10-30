// src/components/ui/Input.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Input from './Input.vue';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Введите текст...' },
  render: (args) => ({
    components: { Input },
    setup() {
      const val = ref('');
      return { args, val };
    },
    template: '<Input v-model="val" v-bind="args" />',
  }),
};

export const Disabled: Story = {
  args: { placeholder: 'Недоступно', disabled: true },
  render: Default.render,
};
