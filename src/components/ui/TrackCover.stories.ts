import type { Meta, StoryObj } from '@storybook/vue3';
import TrackCover from './TrackCover.vue';
import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';

const meta: Meta<typeof TrackCover> = {
  component: TrackCover,
  title: 'Themed/TrackCover',
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TrackCover>;

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1' as TrackId,
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    albumId: null,
    coverUrl: 'https://via.placeholder.com/44/768bbe/ffffff?text=Q',
    pluginId: 'test',
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

const trackWithCover = makeTrack();
const trackEmpty = makeTrack({ id: 'track-2' as TrackId, coverUrl: null, title: 'Unknown', artist: 'Unknown' });

export const WithCover: Story = {
  args: { track: trackWithCover },
  render: (args) => ({
    components: { TrackCover },
    setup: () => ({ args }),
    template: '<TrackCover :track="args.track" />',
  }),
};

export const Empty: Story = {
  args: { track: trackEmpty },
  render: (args) => ({
    components: { TrackCover },
    setup: () => ({ args }),
    template: '<TrackCover :track="args.track" />',
  }),
};

export const Sizes: Story = {
  render: () => ({
    components: { TrackCover },
    setup: () => ({ trackWithCover }),
    template: `
      <div class="flex items-end gap-4">
        <TrackCover :track="trackWithCover" size="h-8 w-8" />
        <TrackCover :track="trackWithCover" />
        <TrackCover :track="trackWithCover" size="h-16 w-16" />
        <TrackCover :track="trackWithCover" size="h-24 w-24" />
      </div>
    `,
  }),
};
