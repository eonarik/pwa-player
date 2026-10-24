// src/components/ui/DropdownMenu.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import DropdownMenu from './DropdownMenu.vue'

const meta: Meta<typeof DropdownMenu> = {
  title: 'UI/DropdownMenu',
  component: DropdownMenu,
  argTypes: {
    width: { control: 'number' },
    align: { control: 'select', options: ['left', 'right'] },
  },
}

export default meta
type Story = StoryObj<typeof DropdownMenu>

export const Default: Story = {
  args: { width: 256, align: 'right' },
  render: (args) => ({
    components: { DropdownMenu },
    setup: () => ({ args }),
    template: `
      <div class="flex justify-center p-10 h-[300px]">
        <DropdownMenu v-bind="args">
          <template #trigger="{ toggle, setTriggerRef }">
            <button :ref="setTriggerRef" type="button" class="rounded-btn bg-card-bg px-4 py-2 text-sm text-fg transition hover:bg-hover-bg" @click.stop="toggle">
              Открыть меню
            </button>
          </template>
          <template #default="{ close }">
            <button class="block w-full px-4 py-2 text-left text-sm text-fg transition hover:bg-hover-bg" @click="close">Пункт 1</button>
            <button class="block w-full px-4 py-2 text-left text-sm text-fg transition hover:bg-hover-bg" @click="close">Пункт 2</button>
            <div class="my-1 border-t border-hover-bg"></div>
            <button class="block w-full px-4 py-2 text-left text-sm text-red-400 transition hover:bg-hover-bg" @click="close">Удалить</button>
          </template>
        </DropdownMenu>
      </div>
    `,
  }),
}
