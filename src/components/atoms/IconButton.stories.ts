import type { Meta, StoryObj } from '@storybook/vue3';
import IconButton from './IconButton.vue';

const VARIANTS: Array<'default' | 'ghost' | 'danger' | 'active'> = [
  'default',
  'ghost',
  'danger',
  'active',
];
const SIZES: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];

const meta: Meta<typeof IconButton> = {
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: SIZES },
    variant: { control: 'select', options: VARIANTS },
    disabled: { control: 'boolean' },
    tooltip: { control: 'text' },
  },
  args: { size: 'md', variant: 'default', icon: 'play', label: 'Играть' },
};

export default meta;

type Story = StoryObj<typeof IconButton>;

// Иконка задаётся через `args.icon`, чтобы кнопка не была пустой.
export const Default: Story = {
  render: (args) => ({
    components: { IconButton },
    setup: () => ({ args }),
    template: '<IconButton v-bind="args" />',
  }),
};

export const Variants: Story = {
  render: () => ({
    components: { IconButton },
    setup: () => ({ variants: VARIANTS }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <IconButton v-for="v in variants" :key="v" :variant="v" icon="play" :label="v" />
      </div>
    `,
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { IconButton },
    setup: () => ({ sizes: SIZES }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <IconButton v-for="s in sizes" :key="s" :size="s" icon="play" :label="s" />
      </div>
    `,
  }),
};

export const Disabled: Story = {
  render: () => ({
    components: { IconButton },
    setup: () => ({ variants: VARIANTS }),
    template: `
      <div class="flex flex-wrap items-center gap-4">
        <IconButton v-for="v in variants" :key="v" :variant="v" :disabled="true" icon="play" :label="v" />
      </div>
    `,
  }),
};

export const Matrix: Story = {
  render: () => ({
    components: { IconButton },
    setup: () => ({ variants: VARIANTS, sizes: SIZES }),
    template: `
      <div class="flex flex-col gap-3">
        <div v-for="s in sizes" :key="s" class="flex flex-wrap items-center gap-3">
          <span class="w-8 shrink-0 text-xs text-fg-muted">{{ s }}</span>
          <IconButton v-for="v in variants" :key="v" :variant="v" :size="s" icon="play" :label="v" />
        </div>
      </div>
    `,
  }),
};

// Все иконки из реестра, чтобы видеть контраст и размеры.
export const AllIcons: Story = {
  render: () => ({
    components: { IconButton },
    setup: () => ({ iconNames: ['play', 'pause', 'next', 'prev', 'shuffle', 'repeat', 'volume', 'volume-mute', 'list', 'settings', 'search', 'heart', 'trash', 'plus', 'check', 'dots', 'x', 'arrow-left', 'arrow-right', 'chevron-down', 'filter', 'feedback'] }),
    template: `
      <div class="flex flex-wrap items-center gap-3">
        <IconButton v-for="name in iconNames" :key="name" :icon="name" :label="name" />
      </div>
    `,
  }),
};
