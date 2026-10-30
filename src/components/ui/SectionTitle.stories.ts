// src/components/ui/SectionTitle.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import SectionTitle from './SectionTitle.vue';

const meta: Meta<typeof SectionTitle> = {
  title: 'UI/SectionTitle',
  component: SectionTitle,
};

export default meta;
type Story = StoryObj<typeof SectionTitle>;

export const Default: Story = {
  render: () => ({
    components: { SectionTitle },
    template: `<SectionTitle text="Треки" />`,
  }),
};

export const WithTrailing: Story = {
  render: () => ({
    components: { SectionTitle },
    template: `
      <SectionTitle text="Мои станции">
        <template #trailing>
          <button class="text-xs text-active">Добавить</button>
        </template>
      </SectionTitle>
    `,
  }),
};
