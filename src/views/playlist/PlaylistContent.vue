<!-- src/views/playlist/PlaylistContent.vue -->
<script setup lang="ts">
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import ListContainer from '@/components/ui/ListContainer.vue'
import type { ArtistGroup } from '@/composables/useLibrarySearch'
import type { Track } from '@/types/track'
import type { Playlist } from '@/types/playlist'

const props = defineProps<{
  playlist: Playlist
  resolvedTracks: Track[]
  isPlaying: boolean
  currentTrackId: string | null
  hasQuery: boolean
  hasResults: boolean
  searchFlatTracks: Track[]
  groups: ArtistGroup[]
}>()

const emit = defineEmits<{
  (e: 'select-track', index: number): void
  (e: 'select-search-track', trackId: string): void
  (e: 'removed'): void
}>()

function isCurrent(trackId: string): boolean {
  return props.currentTrackId === trackId
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl">
      <div v-if="playlist.tracks.length === 0"
        class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
        Плейлист пуст
      </div>

      <!-- Режим поиска (без изменений) -->
      <template v-else-if="hasQuery">
        <div class="p-2">
          <div v-if="!hasResults" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
            Ничего не найдено
          </div>

          <div v-else class="flex flex-col gap-4">
            <div v-for="group in groups" :key="group.artist">
              <p class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {{ group.artist }}
              </p>

              <ListContainer max-width="lg">
                <TrackListItem v-for="track in group.tracks" :key="track.id" :track="track"
                  :index="searchFlatTracks.findIndex((t) => t.id === track.id)" :is-current="isCurrent(track.id)"
                  :is-playing="isPlaying" @select="() => emit('select-search-track', track.id)">
                  <template #actions>
                    <TrackActions :track="track" />
                  </template>
                </TrackListItem>
              </ListContainer>
            </div>
          </div>
        </div>
      </template>

      <!-- Обычный режим -->
      <ListContainer v-else max-width="lg" class="-mx-2.5 p-2">
        <TrackListItem v-for="(track, index) in resolvedTracks" :key="track.id" :track="track" :index="index"
          :is-current="isCurrent(track.id)" :is-playing="isPlaying" @select="() => emit('select-track', index)">
          <template #actions>
            <TrackActions :track="track" :playlist-id="playlist.id" @removed-from-playlist="emit('removed')" />
          </template>
        </TrackListItem>
      </ListContainer>
    </div>
  </div>
</template>
