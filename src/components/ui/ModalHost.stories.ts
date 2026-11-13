import type { Meta, StoryObj } from '@storybook/vue3';
import { h, defineComponent } from 'vue';
import ModalHost from './ModalHost.vue';
import { modalService } from '@/services/ui/ModalService';

const meta: Meta<typeof ModalHost> = {
  component: ModalHost,
  title: 'Organisms/ModalHost',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ModalHost>;

/** Кастомный компонент для модалки */
const CustomContent = defineComponent({
  name: 'CustomContent',
  setup() {
    return () =>
      h('div', { class: 'bg-bg-elevated rounded-card p-6 max-w-sm' }, [
        h('h2', { class: 'text-lg font-medium text-fg mb-2' }, 'Кастомная модалка'),
        h('p', { class: 'text-sm text-fg-muted' }, 'Контент из компонента'),
        h(
          'button',
          {
            class: 'mt-4 rounded-btn bg-active px-4 py-2 text-sm text-fg',
            onClick: () => modalService.cancel(),
          },
          'Закрыть',
        ),
      ]);
  },
});

export const Confirm: Story = {
  play: async () => {
    modalService.active.value = null;
    void modalService.show({
      title: 'Удалить трек?',
      message: 'Это действие нельзя отменить.',
      type: 'confirm',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
    });
  },
};

export const Input: Story = {
  play: async () => {
    modalService.active.value = null;
    void modalService.show({
      title: 'Название плейлиста',
      type: 'input',
      inputType: 'text',
      inputPlaceholder: 'Введите название',
      confirmLabel: 'Создать',
      cancelLabel: 'Отмена',
    });
  },
};

export const Custom: Story = {
  play: async () => {
    modalService.active.value = null;
    void modalService.show({
      title: 'Custom',
      type: 'custom',
      component: CustomContent,
    });
  },
};
