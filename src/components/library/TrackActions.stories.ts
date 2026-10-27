// src/components/library/TrackActions.stories.ts
import type { Meta, StoryObj } from '@storybook/vue3'
import TrackActions from './TrackActions.vue'
import type { LibraryTrack } from '@/types/library'

const meta: Meta<typeof TrackActions> = {
  title: 'Library/TrackActions',
  component: TrackActions,
}

export default meta
type Story = StoryObj<typeof TrackActions>

const sampleTrack: LibraryTrack = {
  id: 'track:test:1',
  pluginId: 'local',
  folderId: 'folder:test',
  title: 'Karma Police',
  artist: 'Radiohead',
  album: 'OK Computer',
  filename: '01.mp3',
  path: '01.mp3',
  sources: [
    { id: 'track:test:1', pluginId: 'local', url: 'https://example.com/song.mp3', priority: 10 },
  ],
  fileLocation: 'remote-only',
  duration: 261,
}

export const Default: Story = {
  args: { track: sampleTrack },
  render: (args) => ({
    components: { TrackActions },
    setup: () => ({ args }),
    template: `<div class="p-10"><TrackActions v-bind="args" /></div>`,
  }),
}
