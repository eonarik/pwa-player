// src/components/library/FolderSettingsMenu.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import FolderSettingsMenu from './FolderSettingsMenu.vue'

const meta: Meta<typeof FolderSettingsMenu> = {
  title: 'Library/FolderSettingsMenu',
  component: FolderSettingsMenu,
}

export default meta
type Story = StoryObj<typeof FolderSettingsMenu>

export const Default: Story = {
  render: () => ({
    components: { FolderSettingsMenu },
    template: `<div class="p-10"><FolderSettingsMenu /></div>`,
  }),
}
