// src/components/player/PlayerControls.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import PlayerControls from './PlayerControls.vue'

const meta: Meta<typeof PlayerControls> = {
  title: 'Player/PlayerControls',
  component: PlayerControls,
}

export default meta
type Story = StoryObj<typeof PlayerControls>

export const Empty: Story = {
  render: () => ({
    components: { PlayerControls },
    template: `<div class="max-w-4xl"><PlayerControls /></div>`,
  }),
}
