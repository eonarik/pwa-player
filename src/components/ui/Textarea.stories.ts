import type { Meta, StoryObj } from '@storybook/vue3'
import { ref } from 'vue'
import Textarea from './Textarea.vue'

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
}

export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: 'Введите сообщение...', rows: 4 },
  render: (args) => ({
    components: { Textarea },
    setup() {
      const val = ref('')
      return { args, val }
    },
    template: '<Textarea v-model="val" v-bind="args" />',
  }),
}
