import type { Meta, StoryObj } from '@storybook/vue3';
import ListRow from './ListRow.vue';

const meta: Meta<typeof ListRow> = {
  component: ListRow,
  tags: ['autodocs'],
  argTypes: {
    active: { control: 'boolean' },
    disliked: { control: 'boolean' },
    downloaded: { control: 'boolean' },
  },
};

export default meta;

type Story = StoryObj<typeof ListRow>;

export const Default: Story = {
  render: () => ({
    components: { ListRow },
    template: `
      <ListRow>
        <template #title><p class="text-sm">Track Name</p></template>
        <template #subtitle><p class="text-xs text-fg-muted">Artist Name</p></template>
      </ListRow>
    `,
  }),
};

export const Active: Story = {
  args: { active: true },
  render: (args) => ({
    components: { ListRow },
    setup: () => ({ args }),
    template: `
      <ListRow v-bind="args">
        <template #title><p class="text-sm">Playing Track</p></template>
        <template #subtitle><p class="text-xs text-fg-muted">Artist</p></template>
      </ListRow>
    `,
  }),
};

export const States: Story = {
  render: () => ({
    components: { ListRow },
    template: `
      <div class="flex flex-col gap-0.5">
        <ListRow active>
          <template #title><p class="text-sm">Играет</p></template>
        </ListRow>
        <ListRow disliked>
          <template #title><p class="text-sm">Disliked</p></template>
        </ListRow>
        <ListRow :download-progress="0.7">
          <template #title><p class="text-sm">Загружается 70%</p></template>
        </ListRow>
        <ListRow downloaded>
          <template #title><p class="text-sm">Загружен</p></template>
        </ListRow>
        <ListRow>
          <template #title><p class="text-sm">Обычный трек</p></template>
        </ListRow>
      </div>
    `,
  }),
};

export const WithSlots: Story = {
  render: () => ({
    components: { ListRow },
    template: `
      <ListRow>
        <template #leading><div class="h-8 w-8 rounded-full bg-card-bg"></div></template>
        <template #title><p class="text-sm">С иконкой</p></template>
        <template #meta><p class="text-xs text-fg-muted">3:45</p></template>
        <template #trailing><span class="text-xs text-fg-muted">⋯</span></template>
      </ListRow>
    `,
  }),
};
