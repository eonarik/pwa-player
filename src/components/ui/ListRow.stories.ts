// src/components/ui/ListRow.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import ListRow from './ListRow.vue'

const meta: Meta<typeof ListRow> = {
  title: 'UI/ListRow',
  component: ListRow,
  argTypes: {
    active: { control: 'boolean' },
    disliked: { control: 'boolean' },
    downloaded: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof ListRow>

export const Default: Story = {
  args: { active: false, disliked: false, downloaded: false },
  render: (args) => ({
    components: { ListRow },
    setup: () => ({ args }),
    template: `
      <div class="w-full max-w-md bg-bg text-fg">
        <ListRow v-bind="args">
          <template #leading>
            <div class="w-10 h-10 bg-card-bg rounded-md" />
          </template>
          <template #title>
            <p class="text-sm font-medium">Название трека</p>
          </template>
          <template #subtitle>
            <p class="text-xs text-fg-muted">Исполнитель</p>
          </template>
          <template #trailing>
            <div class="text-xs text-fg-subtle">3:45</div>
          </template>
        </ListRow>
      </div>
    `,
  }),
}

export const Active: Story = {
  args: { active: true },
  render: Default.render,
}

export const Downloaded: Story = {
  args: { downloaded: true },
  render: Default.render,
}
