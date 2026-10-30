// src/components/ui/ToastHost.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import ToastHost from './ToastHost.vue';
import { toastService } from '@/services/ui/ToastService';
import Button from './Button.vue';

const meta: Meta<typeof ToastHost> = {
  title: 'UI/ToastHost',
  component: ToastHost,
};

export default meta;
type Story = StoryObj<typeof ToastHost>;

export const AllTypes: Story = {
  render: () => ({
    components: { ToastHost, Button },
    setup() {
      const showInfo = () => toastService.info('Это информационное сообщение');
      const showSuccess = () => toastService.success('Операция успешно завершена');
      const showError = () => toastService.error('Произошла ошибка');
      const showAction = () =>
        toastService.showPersistent('Доступно обновление', 'info', {
          label: 'Перезагрузить',
          onAction: () => console.log('Reload clicked'),
        });
      return { showInfo, showSuccess, showError, showAction };
    },
    template: `
      <div class="flex flex-col items-start gap-2">
        <Button @click="showInfo">Info</Button>
        <Button @click="showSuccess">Success</Button>
        <Button @click="showError">Error</Button>
        <Button @click="showAction">Action Toast</Button>
        <ToastHost />
      </div>
    `,
  }),
};
