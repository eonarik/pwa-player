// src/components/ui/Checkbox.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import Checkbox from './Checkbox.vue';

const meta: Meta<typeof Checkbox> = {
  title: 'UI/Checkbox',
  component: Checkbox,
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: (args) => ({
    components: { Checkbox },
    setup() {
      const checked = ref(true);
      return { args, checked };
    },
    template: '<Checkbox v-model="checked" label="Показывать источник" v-bind="args" />',
  }),
};
