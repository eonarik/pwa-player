<!-- src/components/library/TrackSearchResults.vue -->

<script setup lang="ts">
import type { ArtistGroup } from '@/composables/useLibrarySearch';
import type { Track } from '@/types/track';
import TrackListItem from './TrackListItem.vue';
import TrackActions from './TrackActions.vue';
import ListContainer from '@/components/ui/ListContainer.vue';

const props = defineProps<{
  groups: ArtistGroup[];
  flatTracks: Track[];
  isCurrent: (trackId: string) => boolean;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  (e: 'select-track', trackId: string): void;
}>();

function indexOfTrack(trackId: string): number {
  return props.flatTracks.findIndex((t) => t.id === trackId);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-for="group in groups" :key="group.artist">
      <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
        {{ group.artist }}
      </p>
      <ListContainer max-width="lg">
        <TrackListItem
          v-for="track in group.tracks"
          :key="track.id"
          :track="track"
          :index="indexOfTrack(track.id)"
          :is-current="isCurrent(track.id)"
          :is-playing="isPlaying"
          @select="() => emit('select-track', track.id)"
        >
          <template #actions>
            <slot name="track-actions" :track="track" :index="indexOfTrack(track.id)">
              <TrackActions :track="track" />
            </slot>
          </template>
        </TrackListItem>
      </ListContainer>
    </div>
  </div>
</template>
