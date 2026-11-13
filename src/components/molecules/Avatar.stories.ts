import type { Meta, StoryObj } from '@storybook/vue3';
import Avatar from './Avatar.vue';

const meta: Meta<typeof Avatar> = {
  component: Avatar,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;

type Story = StoryObj<typeof Avatar>;

export const Placeholder: Story = {
  args: { size: 'md' },
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args" />',
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { Avatar },
    template: `
      <div class="flex items-end gap-4">
        <Avatar size="sm" />
        <Avatar size="md" />
        <Avatar size="lg" />
      </div>
    `,
  }),
};

export const WithImage: Story = {
  args: { src: 'https://via.placeholder.com/96/768bbe/ffffff?text=A', size: 'md' },
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args" />',
  }),
};

export const BrokenImage: Story = {
  args: { src: 'invalid-url.jpg', size: 'md' },
  render: (args) => ({
    components: { Avatar },
    setup: () => ({ args }),
    template: '<Avatar v-bind="args" />',
  }),
};
