// src/components/ui/EmptyState.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import EmptyState from './EmptyState.vue'
import Button from './Button.vue'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
}

export default meta
type Story = StoryObj<typeof EmptyState>

export const Default: Story = {
  args: {
    icon: 'radio',
    title: 'Станций пока нет',
    description: 'Добавьте первую станцию из каталога',
  },
  render: (args) => ({
    components: { EmptyState, Button },
    setup: () => ({ args }),
    template: `
      <div class="w-full max-w-md">
        <EmptyState v-bind="args">
          <Button variant="primary" class="mt-4">Открыть каталог</Button>
        </EmptyState>
      </div>
    `,
  }),
}
