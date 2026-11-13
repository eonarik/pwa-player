import type { Meta, StoryObj } from '@storybook/vue3';
import ToastHost from './ToastHost.vue';
import { toastService } from '@/services/ui/ToastService';

const meta: Meta<typeof ToastHost> = {
  component: ToastHost,
  title: 'Organisms/ToastHost',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ToastHost>;

/** Очистить тосты перед рендером */
function cleanToasts() {
  toastService.toasts.value = [];
}

/** Создать тост и сразу вернуть его ID для контроля */
function makeToast(message: string, type: 'info' | 'success' | 'error', duration = 4000) {
  cleanToasts();
  toastService.show(message, type, duration);
}

/** Создать тост с кнопкой действия */
function makeToastWithAction(message: string, actionLabel: string) {
  cleanToasts();
  toastService.showPersistent(message, 'info', {
    label: actionLabel,
    onAction: () => {},
  });
}

export const Info: Story = {
  args: {},
  play: async () => {
    makeToast('Файл сохранён', 'info');
  },
};

export const Success: Story = {
  args: {},
  play: async () => {
    makeToast('Треки добавлены в плейлист', 'success');
  },
};

export const Error: Story = {
  args: {},
  play: async () => {
    makeToast('Ошибка подключения к серверу', 'error');
  },
};

export const WithAction: Story = {
  args: {},
  play: async () => {
    makeToastWithAction('Файл слишком большой. Повторить?', 'Повторить');
  },
};

export const Queue: Story = {
  args: {},
  play: async () => {
    cleanToasts();
    toastService.show('Синхронизация...', 'info');
    toastService.show('Треки загружены', 'success');
    toastService.show('Ошибка сервера', 'error');
  },
};
