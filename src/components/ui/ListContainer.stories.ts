import type { Meta, StoryObj } from '@storybook/vue3'
import ListContainer from './ListContainer.vue'

const meta: Meta<typeof ListContainer> = {
  title: 'UI/ListContainer',
  component: ListContainer,
}

export default meta
type Story = StoryObj<typeof ListContainer>

export const Default: Story = {
  render: () => ({
    components: { ListContainer },
    template: `
      <ListContainer>
        <div class="bg-card-bg p-2 text-sm text-fg">Элемент 1</div>
        <div class="bg-card-bg p-2 text-sm text-fg">Элемент 2</div>
        <div class="bg-card-bg p-2 text-sm text-fg">Элемент 3</div>
      </ListContainer>
    `,
  }),
}
