import type { Meta, StoryObj } from '@storybook/vue3';
import Button from '../atoms/Button.vue';
import EmptyState from './EmptyState.vue';

const meta: Meta<typeof EmptyState> = {
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: { title: 'Пусто' },
  render: (args) => ({
    components: { EmptyState },
    setup: () => ({ args }),
    template: '<EmptyState v-bind="args" />',
  }),
};

export const WithDescription: Story = {
  args: { title: 'Ничего не найдено', description: 'Попробуйте изменить параметры поиска' },
  render: (args) => ({
    components: { EmptyState },
    setup: () => ({ args }),
    template: '<EmptyState v-bind="args" />',
  }),
};

export const WithSlot: Story = {
  args: { title: 'Плейлисты не созданы' },
  render: (args) => ({
    components: { EmptyState, Button },
    setup: () => ({ args }),
    template: `
      <EmptyState v-bind="args">
        <template #icon><span class="text-2xl">+</span></template>
        <Button class="mt-4">Создать</Button>
      </EmptyState>
    `,
  }),
};
