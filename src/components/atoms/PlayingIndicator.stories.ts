import type { Meta, StoryObj } from '@storybook/vue3';
import PlayingIndicator from './PlayingIndicator.vue';

const meta: Meta<typeof PlayingIndicator> = {
  component: PlayingIndicator,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PlayingIndicator>;

export const Default: Story = {
  render: () => ({
    components: { PlayingIndicator },
    template: `
      <div class="relative h-16 w-16 rounded-card bg-card-bg">
        <PlayingIndicator />
      </div>
    `,
  }),
};
