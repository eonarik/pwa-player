import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import Toggle from './Toggle.vue'

const meta: Meta<typeof Toggle> = {
  title: 'UI/Toggle',
  component: Toggle,
}

export default meta
type Story = StoryObj<typeof Toggle>

export const Default: Story = {
  render: () => ({
    components: { Toggle },
    setup() {
      const enabled = ref(true)
      return { enabled }
    },
    template: `
      <div class="flex items-center gap-3">
        <Toggle v-model="enabled" />
        <span class="text-sm text-fg">{{ enabled ? 'Включено' : 'Выключено' }}</span>
      </div>
    `,
  }),
}
