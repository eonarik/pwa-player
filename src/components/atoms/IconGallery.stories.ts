import type { Meta, StoryObj } from '@storybook/vue3';
import Icon from '../atoms/Icon.vue';
import { ICONS } from '../icons';

const meta: Meta<typeof Icon> = {
  component: Icon,
  tags: ['autodocs'],
  title: 'Atoms/IconGallery',
};

export default meta;

type Story = StoryObj<typeof Icon>;

const iconNames = Object.keys(ICONS);

export const Gallery: Story = {
  render: () => ({
    components: { Icon },
    setup: () => ({ iconNames }),
    template: `
      <div class="grid grid-cols-8 gap-3 p-4">
        <div v-for="name in iconNames" :key="name" class="flex flex-col items-center gap-1">
          <div class="w-8 h-8 flex items-center justify-center rounded-card bg-card-bg hover:bg-hover-bg transition">
            <Icon :name="name" w="w-5" h="h-5" />
          </div>
          <span class="text-[9px] text-fg-muted text-center truncate w-full">{{ name }}</span>
        </div>
      </div>
    `,
  }),
};
