// src/components/ui/ModalLayout.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import ModalLayout from './ModalLayout.vue'
import Button from './Button.vue'
import Input from './Input.vue'
import { ref } from 'vue'

const meta: Meta<typeof ModalLayout> = {
  title: 'UI/ModalLayout',
  component: ModalLayout,
}

export default meta
type Story = StoryObj<typeof ModalLayout>

export const Default: Story = {
  args: { title: 'Редактировать метаданные', maxWidth: 'md' },
  render: (args) => ({
    components: { ModalLayout, Button, Input },
    setup() {
      const name = ref('')
      return { args, name }
    },
    template: `
      <ModalLayout v-bind="args" @close="() => {}">
        <div class="flex flex-col gap-4">
          <Input v-model="name" placeholder="Название трека" />
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <Button variant="ghost">Отмена</Button>
            <Button variant="primary">Сохранить</Button>
          </div>
        </template>
      </ModalLayout>
    `,
  }),
}
