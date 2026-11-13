import type { Meta, StoryObj } from '@storybook/vue3';
import Spinner from './Spinner.vue';

const meta: Meta<typeof Spinner> = {
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;

type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: { size: 'md' },
  render: (args) => ({
    components: { Spinner },
    setup: () => ({ args }),
    template: '<Spinner v-bind="args" />',
  }),
};

export const WithText: Story = {
  args: { size: 'md', text: 'Загрузка...' },
  render: (args) => ({
    components: { Spinner },
    setup: () => ({ args }),
    template: '<Spinner v-bind="args" />',
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Spinner },
    template: `
      <div class="flex flex-wrap gap-4 items-center">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
      </div>
    `,
  }),
};
