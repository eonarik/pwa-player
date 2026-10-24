import type { Meta, StoryObj } from '@storybook/vue3'
import TrackRow from './TrackRow.vue'
import type { LibraryTrack } from '@/types/library'

const meta: Meta<typeof TrackRow> = {
  title: 'Library/TrackRow',
  component: TrackRow,
  argTypes: {
    isCurrent: { control: 'boolean' },
    isPlaying: { control: 'boolean' },
  },
}

export default meta

const sampleTrack: LibraryTrack = {
  id: 'track:test:1',
  pluginId: 'local',
  folderId: 'folder:test',
  title: 'Karma Police',
  artist: 'Radiohead',
  album: 'OK Computer',
  filename: '01.mp3',
  path: '01.mp3',
  source: 'https://example.com/song.mp3',
  fileLocation: 'remote-only',
  duration: 261,
}

type Story = StoryObj<typeof TrackRow>

export const Default: Story = {
  args: {
    track: sampleTrack,
    index: 0,
    isCurrent: false,
    isPlaying: false,
    showDownload: true,
  },
  render: (args) => ({
    components: { TrackRow },
    setup: () => ({ args }),
    template: '<TrackRow v-bind="args" />',
  }),
}

export const Playing: Story = {
  args: { ...Default.args, isCurrent: true, isPlaying: true },
  render: Default.render,
}

export const Local: Story = {
  args: {
    ...Default.args,
    track: { ...sampleTrack, fileLocation: 'both' },
  },
  render: Default.render,
}

export const Unavailable: Story = {
  args: {
    ...Default.args,
    track: { ...sampleTrack, source: '' },
  },
  render: Default.render,
}
