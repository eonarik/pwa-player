import type { Meta, StoryObj } from '@storybook/vue3';
import LinkButton from './LinkButton.vue';

const meta: Meta<typeof LinkButton> = {
  component: LinkButton,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof LinkButton>;

export const Default: Story = {
  args: {},
  render: (args) => ({
    components: { LinkButton },
    setup: () => ({ args }),
    template: '<LinkButton v-bind="args">Подробнее</LinkButton>',
  }),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => ({
    components: { LinkButton },
    setup: () => ({ args }),
    template: '<LinkButton v-bind="args">Отключено</LinkButton>',
  }),
};
