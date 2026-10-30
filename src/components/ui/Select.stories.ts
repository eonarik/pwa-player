// src/components/ui/Select.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Select from './Select.vue';

const meta: Meta<typeof Select> = {
  title: 'UI/Select',
  component: Select,
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    options: [
      { value: 'default', label: 'Тёмная' },
      { value: 'radio', label: 'Ретро-радио' },
      { value: 'neon', label: 'Киберпанк' },
    ],
  },
  render: (args) => ({
    components: { Select },
    setup() {
      const val = ref('default');
      return { args, val };
    },
    template: '<Select v-model="val" v-bind="args" />',
  }),
};
