import type { Meta, StoryObj } from '@storybook/vue3';
import ProgressBar from './ProgressBar.vue';

const meta: Meta<typeof ProgressBar> = {
  component: ProgressBar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md'] },
  },
};

export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Half: Story = {
  args: { value: 50, max: 100 },
  render: (args) => ({
    components: { ProgressBar },
    setup: () => ({ args }),
    template: '<ProgressBar v-bind="args" />',
  }),
};

export const Full: Story = {
  args: { value: 100, max: 100 },
  render: (args) => ({
    components: { ProgressBar },
    setup: () => ({ args }),
    template: '<ProgressBar v-bind="args" />',
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { ProgressBar },
    template: `
      <div class="flex flex-col gap-4 w-full">
        <ProgressBar :value="30" size="sm" />
        <ProgressBar :value="60" size="md" />
      </div>
    `,
  }),
};
