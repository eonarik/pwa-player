// src/components/ui/FormField.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import FormField from './FormField.vue';
import Input from './Input.vue';

const meta: Meta<typeof FormField> = {
  title: 'UI/FormField',
  component: FormField,
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  args: { label: 'Название плейлиста', hint: 'Можно изменить позже' },
  render: (args) => ({
    components: { FormField, Input },
    setup() {
      const val = ref('');
      return { args, val };
    },
    template: `
      <FormField v-bind="args">
        <Input v-model="val" placeholder="Мой плейлист" />
      </FormField>
    `,
  }),
};

export const WithError: Story = {
  args: { label: 'Email', error: 'Некорректный email' },
  render: Default.render,
};
