import type { Meta, StoryObj } from '@storybook/vue3';
import Divider from './Divider.vue';

const meta: Meta<typeof Divider> = {
  component: Divider,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Divider>;

export const Horizontal: Story = {
  render: () => ({
    components: { Divider },
    template: `
      <div class="flex flex-col gap-4 p-4">
        <div class="text-sm text-fg-muted">Первая группа элементов</div>
        <Divider />
        <div class="text-sm text-fg-muted">Вторая группа (разделитель между строками)</div>
        <Divider with-margin />
        <div class="text-sm text-fg-muted">Третья группа с отступом</div>
      </div>
    `,
  }),
};

export const Vertical: Story = {
  render: () => ({
    components: { Divider },
    template: `
      <div class="flex items-center gap-4 p-4 text-fg-muted">
        <span>Первый</span>
        <Divider vertical />
        <span>Второй</span>
        <Divider vertical />
        <span>Третий</span>
      </div>
    `,
  }),
};

export const Mixed: Story = {
  render: () => ({
    components: { Divider },
    template: `
      <div class="flex flex-col gap-2 p-4">
        <div class="text-sm text-fg-muted">Горизонтальные и вертикальные разделители вместе</div>
        <Divider />
        <div class="flex items-center gap-3 text-fg">
          <span>Слева</span>
          <Divider vertical />
          <span>По центру</span>
          <Divider vertical />
          <span>Справа</span>
        </div>
        <Divider />
        <div class="text-sm text-fg-muted">Конец блока</div>
      </div>
    `,
  }),
};
