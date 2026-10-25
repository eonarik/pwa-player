// src/components/ui/PlayingIndicator.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import PlayingIndicator from './PlayingIndicator.vue'

const meta: Meta<typeof PlayingIndicator> = {
  title: 'UI/PlayingIndicator',
  component: PlayingIndicator,
  argTypes: {},
}

export default meta
type Story = StoryObj<typeof PlayingIndicator>

export const Bars: Story = {
  args: {},
  render: (args) => ({
    components: { PlayingIndicator },
    setup: () => ({ args }),
    template: `
      <div class="relative w-16 h-16 bg-card-bg">
        <PlayingIndicator v-bind="args" />
      </div>
    `,
  }),
}
