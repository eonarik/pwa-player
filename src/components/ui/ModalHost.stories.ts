// src/components/ui/ModalHost.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import ModalHost from './ModalHost.vue';
import { modalService } from '@/services/ui/ModalService';
import Button from './Button.vue';

const meta: Meta<typeof ModalHost> = {
  title: 'UI/ModalHost',
  component: ModalHost,
};

export default meta;
type Story = StoryObj<typeof ModalHost>;

export const Confirm: Story = {
  render: () => ({
    components: { ModalHost, Button },
    setup() {
      const open = () => {
        void modalService.show({
          title: 'Подтверждение',
          message: 'Вы уверены, что хотите удалить этот плейлист?',
          type: 'confirm',
          confirmLabel: 'Удалить',
        });
      };
      return { open };
    },
    template: `
      <div>
        <Button variant="danger" @click="open">Открыть модалку</Button>
        <ModalHost />
      </div>
    `,
  }),
};

export const Input: Story = {
  render: () => ({
    components: { ModalHost, Button },
    setup() {
      const open = () => {
        void modalService.show({
          title: 'Введите название',
          type: 'input',
          inputPlaceholder: 'Новый плейлист...',
        });
      };
      return { open };
    },
    template: `
      <div>
        <Button variant="primary" @click="open">Открыть модалку</Button>
        <ModalHost />
      </div>
    `,
  }),
};
