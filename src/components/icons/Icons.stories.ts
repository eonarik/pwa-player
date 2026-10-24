// src/components/icons/Icons.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import { ICONS } from './index'

const meta: Meta = {
  title: 'Icons/All',
}

export default meta
type Story = StoryObj

export const Grid: Story = {
  render: () => ({
    setup() {
      return { ICONS }
    },
    template: `
      <div class="grid grid-cols-6 gap-4 p-4">
        <div v-for="(icon, name) in ICONS" :key="name" class="flex flex-col items-center gap-2 text-fg">
          <component :is="icon" class="h-6 w-6" />
          <span class="text-[10px] text-fg-muted">{{ name }}</span>
        </div>
      </div>
    `,
  }),
}
