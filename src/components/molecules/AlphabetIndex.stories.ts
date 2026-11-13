import type { Meta, StoryObj } from '@storybook/vue3';
import AlphabetIndex from './AlphabetIndex.vue';

const meta: Meta<typeof AlphabetIndex> = {
  component: AlphabetIndex,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof AlphabetIndex>;

export const Default: Story = {
  args: { letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
  render: (args) => ({
    components: { AlphabetIndex },
    setup: () => ({ args }),
    template: `
      <div class="relative h-96">
        <AlphabetIndex v-bind="args" />
        <p class="text-xs text-fg-muted">Алфавитный индекс справа. Клик или drag для навигации.</p>
      </div>
    `,
  }),
};

export const Russian: Story = {
  args: { letters: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('') },
  render: (args) => ({
    components: { AlphabetIndex },
    setup: () => ({ args }),
    template: `
      <div class="relative h-96">
        <AlphabetIndex v-bind="args" />
      </div>
    `,
  }),
};
