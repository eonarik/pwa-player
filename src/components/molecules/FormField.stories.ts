import type { Meta, StoryObj } from '@storybook/vue3';
import Input from '../atoms/Input.vue';
import FormField from './FormField.vue';

const meta: Meta<typeof FormField> = {
  component: FormField,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    error: { control: 'text' },
  },
};

export default meta;

type Story = StoryObj<typeof FormField>;

export const WithLabel: Story = {
  args: { label: 'Название трека' },
  render: (args) => ({
    components: { FormField, Input },
    setup: () => ({ args, model: '' }),
    template: '<FormField v-bind="args"><Input v-model="model" /></FormField>',
  }),
};

export const WithHint: Story = {
  args: { label: 'Описание', hint: 'Необязательно' },
  render: (args) => ({
    components: { FormField, Input },
    setup: () => ({ args, model: '' }),
    template: '<FormField v-bind="args"><Input v-model="model" /></FormField>',
  }),
};

export const WithError: Story = {
  args: { label: 'Имя', error: 'Поле обязательно' },
  render: (args) => ({
    components: { FormField, Input },
    setup: () => ({ args, model: '' }),
    template: '<FormField v-bind="args"><Input v-model="model" /></FormField>',
  }),
};
