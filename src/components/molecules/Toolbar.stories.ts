import type { Meta, StoryObj } from '@storybook/vue3';
import Toolbar from './Toolbar.vue';
import Button from '../atoms/Button.vue';

const meta: Meta<typeof Toolbar> = {
  component: Toolbar,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'border'] },
  },
};

export default meta;

type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => ({
    components: { Toolbar, Button },
    template: `
      <Toolbar>
        <Button size="sm" variant="ghost">Отмена</Button>
        <Button size="sm" variant="primary">Сохранить</Button>
      </Toolbar>
    `,
  }),
};

export const WithBorder: Story = {
  args: { variant: 'border' },
  render: (args) => ({
    components: { Toolbar, Button },
    setup: () => ({ args }),
    template: `
      <div class="flex flex-col gap-4">
        <Toolbar v-bind="args">
          <Button size="sm">Кнопка</Button>
          <Button size="sm" variant="ghost">Отмена</Button>
        </Toolbar>
        <p class="text-sm text-fg-muted">Контент под toolbar</p>
      </div>
    `,
  }),
};
