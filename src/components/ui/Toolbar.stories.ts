// src/components/ui/Toolbar.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import Toolbar from './Toolbar.vue';
import IconButton from './IconButton.vue';
import IconSettings from '@/components/icons/IconSettings.vue';
import IconRefresh from '@/components/icons/IconRefresh.vue';

const meta: Meta<typeof Toolbar> = {
  title: 'UI/Toolbar',
  component: Toolbar,
};

export default meta;
type Story = StoryObj<typeof Toolbar>;

export const Default: Story = {
  render: () => ({
    components: { Toolbar, IconButton, IconSettings, IconRefresh },
    template: `
      <Toolbar variant="border">
        <IconButton label="Настройки"><IconSettings class="h-4 w-4" /></IconButton>
        <IconButton label="Обновить"><IconRefresh class="h-4 w-4" /></IconButton>
      </Toolbar>
    `,
  }),
};
