import type { Meta, StoryObj } from '@storybook/vue3'
import PageHeader from './PageHeader.vue'
import Button from './Button.vue'

const meta: Meta<typeof PageHeader> = {
  title: 'UI/PageHeader',
  component: PageHeader,
}

export default meta
type Story = StoryObj<typeof PageHeader>

export const Default: Story = {
  args: { title: 'История', subtitle: '24 записи' },
  render: (args) => ({
    components: { PageHeader, Button },
    setup: () => ({ args }),
    template: `
      <PageHeader v-bind="args">
        <Button variant="primary" size="sm">Играть всё</Button>
      </PageHeader>
    `,
  }),
}
