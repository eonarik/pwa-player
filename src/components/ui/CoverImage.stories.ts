import type { Meta, StoryObj } from '@storybook/vue3';
import CoverImage from './CoverImage.vue';

const meta: Meta<typeof CoverImage> = {
  component: CoverImage,
  title: 'Themed/CoverImage',
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['album', 'artist'] },
  },
};

export default meta;

type Story = StoryObj<typeof CoverImage>;

export const WithSrc: Story = {
  args: { src: 'https://via.placeholder.com/96/768bbe/ffffff?text=Cover', alt: 'Album cover' },
  render: (args) => ({
    components: { CoverImage },
    setup: () => ({ args }),
    template: '<CoverImage v-bind="args" />',
  }),
};

export const Empty: Story = {
  args: { src: null },
  render: (args) => ({
    components: { CoverImage },
    setup: () => ({ args }),
    template: '<CoverImage v-bind="args" />',
  }),
};

export const Broken: Story = {
  args: { src: 'invalid-url.jpg', alt: 'Broken image' },
  render: (args) => ({
    components: { CoverImage },
    setup: () => ({ args }),
    template: '<CoverImage v-bind="args" />',
  }),
};

export const ArtistVariant: Story = {
  args: { src: 'https://via.placeholder.com/96/eb78b8/ffffff?text=Artist', variant: 'artist' },
  render: (args) => ({
    components: { CoverImage },
    setup: () => ({ args }),
    template: '<CoverImage v-bind="args" />',
  }),
};
