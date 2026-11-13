import type { Meta, StoryObj } from '@storybook/vue3';
import PageHeader from './PageHeader.vue';
import Button from '../atoms/Button.vue';

const meta: Meta<typeof PageHeader> = {
  component: PageHeader,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;

type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: 'Библиотека' },
  render: (args) => ({
    components: { PageHeader },
    setup: () => ({ args }),
    template: '<PageHeader v-bind="args" />',
  }),
};

export const WithSubtitle: Story = {
  args: { title: 'Альбом', subtitle: '2024 • 12 треков' },
  render: (args) => ({
    components: { PageHeader },
    setup: () => ({ args }),
    template: '<PageHeader v-bind="args" />',
  }),
};

export const WithActions: Story = {
  args: { title: 'Плейлист' },
  render: (args) => ({
    components: { PageHeader, Button },
    setup: () => ({ args }),
    template: `
      <PageHeader v-bind="args">
        <Button variant="primary" size="sm">Играть</Button>
        <Button variant="ghost" size="sm">Ред.</Button>
      </PageHeader>
    `,
  }),
};
