import type { Meta, StoryObj } from '@storybook/vue3';
import { ref } from 'vue';
import InputWithAffix from './InputWithAffix.vue';

const meta: Meta<typeof InputWithAffix> = {
  component: InputWithAffix,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof InputWithAffix>;

export const Default: Story = {
  args: { placeholder: 'Введите значение' },
  render: (args) => ({
    components: { InputWithAffix },
    setup: () => ({ args, model: ref('') }),
    template: '<InputWithAffix v-model="model" v-bind="args" />',
  }),
};

export const WithPrefix: Story = {
  args: { placeholder: 'URL', prefix: 'https://' },
  render: (args) => ({
    components: { InputWithAffix },
    setup: () => ({ args, model: ref('') }),
    template: '<InputWithAffix v-model="model" v-bind="args" />',
  }),
};

export const WithSuffix: Story = {
  args: { placeholder: 'Размер', suffix: 'px' },
  render: (args) => ({
    components: { InputWithAffix },
    setup: () => ({ args, model: ref('16') }),
    template: '<InputWithAffix v-model="model" v-bind="args" />',
  }),
};
