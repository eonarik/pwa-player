import type { Meta, StoryObj } from '@storybook/vue3';
import ListContainer from './ListContainer.vue';

const meta: Meta<typeof ListContainer> = {
  component: ListContainer,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;

type Story = StoryObj<typeof ListContainer>;

export const Default: Story = {
  render: () => ({
    components: { ListContainer },
    template: `
      <ListContainer>
        <div v-for="i in 5" :key="i" class="h-12 rounded-card bg-card-bg"></div>
      </ListContainer>
    `,
  }),
};

export const Widths: Story = {
  render: () => ({
    components: { ListContainer },
    template: `
      <div class="flex flex-col gap-6">
        <div>
          <p class="mb-2 text-xs text-fg-muted">sm</p>
          <ListContainer max-width="sm">
            <div v-for="i in 3" :key="i" class="h-10 rounded-card bg-card-bg"></div>
          </ListContainer>
        </div>
        <div>
          <p class="mb-2 text-xs text-fg-muted">md</p>
          <ListContainer>
            <div v-for="i in 3" :key="i" class="h-10 rounded-card bg-card-bg"></div>
          </ListContainer>
        </div>
        <div>
          <p class="mb-2 text-xs text-fg-muted">lg</p>
          <ListContainer max-width="lg">
            <div v-for="i in 3" :key="i" class="h-10 rounded-card bg-card-bg"></div>
          </ListContainer>
        </div>
      </div>
    `,
  }),
};
