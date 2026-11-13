import type { Meta, StoryObj } from '@storybook/vue3';
import Badge from './Badge.vue';

const meta: Meta<typeof Badge> = {
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'active', 'live', 'danger'] },
  },
  args: { variant: 'default' },
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  render: (args) => ({
    components: { Badge },
    setup: () => ({ args }),
    template: '<Badge v-bind="args">3</Badge>',
  }),
};

export const Variants: Story = {
  render: () => ({
    components: { Badge },
    template: `
      <div class="flex gap-4">
        <Badge variant="default">3</Badge>
        <Badge variant="active">2</Badge>
        <Badge variant="live">LIVE</Badge>
        <Badge variant="danger">!</Badge>
      </div>
    `,
  }),
};
