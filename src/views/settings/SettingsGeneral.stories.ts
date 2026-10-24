// src/views/settings/SettingsGeneral.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import SettingsGeneral from './SettingsGeneral.vue'

const meta: Meta<typeof SettingsGeneral> = {
  title: 'Settings/SettingsGeneral',
  component: SettingsGeneral,
}

export default meta
type Story = StoryObj<typeof SettingsGeneral>

export const Default: Story = {
  render: () => ({
    components: { SettingsGeneral },
    template: `<div class="max-w-2xl"><SettingsGeneral /></div>`,
  }),
}
