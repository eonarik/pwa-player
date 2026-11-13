import type { Meta, StoryObj } from '@storybook/vue3';
import Button from './Button.vue';

const VARIANTS: Array<'primary' | 'secondary' | 'ghost' | 'danger'> = [
  'primary',
  'secondary',
  'ghost',
  'danger',
];
const SIZES: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
  },
  args: { variant: 'secondary', size: 'md' },
};

export default meta;

type Story = StoryObj<typeof Button>;

// Без slot-контента inline-flex схлопывается, поэтому контент задаётся явно.
export const Default: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: '<Button v-bind="args">Кнопка</Button>',
  }),
};

export const Variants: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ variants: VARIANTS }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <Button v-for="v in variants" :key="v" :variant="v">{{ v }}</Button>
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ sizes: SIZES }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <Button v-for="s in sizes" :key="s" :size="s">{{ s }}</Button>
      </div>
    `,
  }),
};

export const Disabled: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ variants: VARIANTS }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <Button v-for="v in variants" :key="v" :variant="v" disabled>{{ v }}</Button>
      </div>
    `,
  }),
};

export const Matrix: Story = {
  render: () => ({
    components: { Button },
    setup: () => ({ variants: VARIANTS, sizes: SIZES }),
    template: `
      <div class="flex flex-col gap-3">
        <div v-for="s in sizes" :key="s" class="flex flex-wrap items-center gap-3">
          <span class="w-8 shrink-0 text-xs text-fg-muted">{{ s }}</span>
          <Button v-for="v in variants" :key="v" :variant="v" :size="s">{{ v }}</Button>
        </div>
      </div>
    `,
  }),
};

export const WithIcon: Story = {
  render: (args) => ({
    components: { Button },
    setup: () => ({ args }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <Button v-bind="args">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          Играть
        </Button>
        <Button v-bind="args">Только текст</Button>
      </div>
    `,
  }),
};
