import type { Meta, StoryObj } from '@storybook/vue3';
import ModalLayout from './ModalLayout.vue';
import Button from '../atoms/Button.vue';
import Input from '../atoms/Input.vue';

const meta: Meta<typeof ModalLayout> = {
  component: ModalLayout,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;

type Story = StoryObj<typeof ModalLayout>;

export const Default: Story = {
  args: { title: 'Заголовок модалки' },
  render: (args) => ({
    components: { ModalLayout, Button, Input },
    setup: () => ({ args, show: true }),
    template: `
      <ModalLayout v-if="show" v-bind="args" @close="show = false">
        <p class="text-sm text-fg-muted">Контент модалки</p>
        <template #footer>
          <Button variant="ghost" size="sm" @click="show = false">Отмена</Button>
          <Button variant="primary" size="sm">Сохранить</Button>
        </template>
      </ModalLayout>
    `,
  }),
};

export const Fullscreen: Story = {
  args: { title: 'Полноэкранная', fullscreen: true },
  render: (args) => ({
    components: { ModalLayout },
    setup: () => ({ args }),
    template: `
      <ModalLayout v-bind="args">
        <p class="text-sm text-fg-muted">Полноэкранный контент</p>
      </ModalLayout>
    `,
  }),
};

export const WithHeaderActions: Story = {
  args: { title: 'Редактирование' },
  render: (args) => ({
    components: { ModalLayout, Button },
    setup: () => ({ args }),
    template: `
      <ModalLayout v-bind="args">
        <p class="text-sm text-fg-muted">Содержимое</p>
        <template #header-actions>
          <Button variant="ghost" size="sm">Действие</Button>
        </template>
      </ModalLayout>
    `,
  }),
};
