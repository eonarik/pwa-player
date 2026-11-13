import type { Meta, StoryObj } from '@storybook/vue3';
import CoverPicker from './CoverPicker.vue';

const meta: Meta<typeof CoverPicker> = {
  component: CoverPicker,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CoverPicker>;

export const Empty: Story = {
  render: () => ({
    components: { CoverPicker },
    setup: () => ({ model: '' }),
    template: '<CoverPicker v-model="model" />',
  }),
};

export const WithCover: Story = {
  render: () => ({
    components: { CoverPicker },
    setup: () => ({ model: 'https://via.placeholder.com/128/768bbe/ffffff?text=Cover' }),
    template: '<CoverPicker v-model="model" />',
  }),
};
