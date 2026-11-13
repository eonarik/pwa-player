import type { Meta, StoryObj } from '@storybook/vue3';
import SectionTitle from './SectionTitle.vue';

const meta: Meta<typeof SectionTitle> = {
  component: SectionTitle,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SectionTitle>;

export const Default: Story = {
  args: { text: 'Треки' },
  render: (args) => ({
    components: { SectionTitle },
    setup: () => ({ args }),
    template: '<SectionTitle v-bind="args" />',
  }),
};

export const Clickable: Story = {
  args: { text: 'Треки' },
  render: (args) => ({
    components: { SectionTitle },
    setup: () => ({ args }),
    template: '<SectionTitle v-bind="args" :clickable="true" />',
  }),
};

export const WithTrailing: Story = {
  args: { text: 'Треки' },
  render: (args) => ({
    components: { SectionTitle },
    setup: () => ({ args }),
    template: `
      <SectionTitle v-bind="args">
        <template #trailing><span class="text-xs text-fg-muted">12 шт.</span></template>
      </SectionTitle>
    `,
  }),
};

export const NoPadding: Story = {
  args: { text: 'Без паддинга', paddingBottom: 'none' },
  render: (args) => ({
    components: { SectionTitle },
    setup: () => ({ args }),
    template: '<SectionTitle v-bind="args" />',
  }),
};
