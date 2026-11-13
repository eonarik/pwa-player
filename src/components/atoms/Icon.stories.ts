import type { Meta, StoryObj } from '@storybook/vue3';
import Icon from './Icon.vue';

const meta: Meta<typeof Icon> = {
  component: Icon,
  tags: ['autodocs'],
  argTypes: {
    name: {
      control: 'select',
      options: [
        'play', 'pause', 'next', 'prev', 'shuffle', 'repeat', 'volume', 'volume-mute',
        'list', 'list-play', 'settings', 'refresh', 'download', 'cloud-check', 'dots',
        'arrow-left', 'arrow-up', 'arrow-down', 'chevron-left', 'chevron-right', 'chevron-down',
        'search', 'heart', 'eye-off', 'spinner', 'trash', 'plus', 'check', 'pencil',
        'share', 'maximize', 'minimize', 'file', 'folder', 'playlist', 'history',
        'home', 'artist', 'album', 'radio', 'link', 'menu', 'feedback',
        'alert-triangle', 'warning', 'grid', 'x', 'play', 'filter',
      ],
    },
    w: { control: 'text' },
    h: { control: 'text' },
  },
  args: { name: 'play' },
};

export default meta;

type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: 'play', w: 'w-4', h: 'h-4' },
  render: (args) => ({
    components: { Icon },
    setup: () => ({ args }),
    template: '<Icon v-bind="args" />',
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Icon },
    template: `
      <div class="flex items-end gap-4">
        <Icon name="play" w="w-3" h="h-3" />
        <Icon name="play" w="w-4" h="h-4" />
        <Icon name="play" w="w-6" h="h-6" />
        <Icon name="play" w="w-8" h="h-8" />
        <Icon name="play" w="w-10" h="h-10" />
      </div>
    `,
  }),
};

export const Colors: Story = {
  render: () => ({
    components: { Icon },
    template: `
      <div class="flex gap-4 items-center">
        <Icon name="play" class="text-fg" />
        <Icon name="play" class="text-active" />
        <Icon name="play" class="text-red-400" />
        <Icon name="play" class="text-fg-muted" />
      </div>
    `,
  }),
};
