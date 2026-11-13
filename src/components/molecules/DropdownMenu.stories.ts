import type { Meta, StoryObj } from '@storybook/vue3';
import DropdownMenu from './DropdownMenu.vue';
import Button from '../atoms/Button.vue';
import Divider from '../atoms/Divider.vue';

const meta: Meta<typeof DropdownMenu> = {
  component: DropdownMenu,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => ({
    components: { DropdownMenu, Button, Divider },
    template: `
      <div class="flex justify-end">
        <DropdownMenu>
          <template #trigger="{ toggle, setTriggerRef }">
            <Button ref="triggerRef" :ref="setTriggerRef" variant="ghost" size="sm" @click="toggle">Меню</Button>
          </template>
          <template #default="{ close }">
            <div class="py-1">
              <button class="block w-full px-4 py-2 text-left text-sm text-fg hover:bg-hover-bg" @click="close">Действие 1</button>
              <button class="block w-full px-4 py-2 text-left text-sm text-fg hover:bg-hover-bg" @click="close">Действие 2</button>
              <Divider />
              <button class="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-hover-bg" @click="close">Удалить</button>
            </div>
          </template>
        </DropdownMenu>
      </div>
    `,
  }),
};

export const AlignLeft: Story = {
  args: { align: 'left' },
  render: () => ({
    components: { DropdownMenu, Button },
    template: `
      <div class="flex justify-start">
        <DropdownMenu align="left">
          <template #trigger="{ toggle, setTriggerRef }">
            <Button variant="ghost" size="sm" :ref="setTriggerRef" @click="toggle">Меню (left)</Button>
          </template>
          <template #default="{ close }">
            <div class="py-1">
              <button class="block w-full px-4 py-2 text-left text-sm text-fg hover:bg-hover-bg" @click="close">Опция A</button>
              <button class="block w-full px-4 py-2 text-left text-sm text-fg hover:bg-hover-bg" @click="close">Опция B</button>
            </div>
          </template>
        </DropdownMenu>
      </div>
    `,
  }),
};
