// src/components/ui/CoverImage.stories.ts

import type { Meta, StoryObj } from '@storybook/vue3';
import CoverImage from './CoverImage.vue';

const meta: Meta<typeof CoverImage> = {
  title: 'UI/CoverImage',
  component: CoverImage,
};

export default meta;
type Story = StoryObj<typeof CoverImage>;

export const WithImage: Story = {
  args: { src: 'https://picsum.photos/200', alt: 'Обложка' },
  render: (args) => ({
    components: { CoverImage },
    setup: () => ({ args }),
    template: `<div class="w-32 h-32 overflow-hidden rounded-card"><CoverImage v-bind="args" /></div>`,
  }),
};

export const Fallback: Story = {
  args: { src: null, alt: 'Нет обложки' },
  render: WithImage.render,
};
