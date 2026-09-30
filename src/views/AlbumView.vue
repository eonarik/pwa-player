<!-- src/views/AlbumView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { filterTracksByArtist, groupByAlbum } from '@/utils/artists'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const library = useLibraryStore()
const player = usePlayerStore()
const { currentTrack, isPlaying } = storeToRefs(player)

const artistName = computed(() => String(route.params.artistName ?? ''))
const albumSlug = computed(() => String(route.params.album ?? ''))

const artistTracks = computed<LibraryTrack[]>(() =>
  filterTracksByArtist(Object.values(library.tracks), artistName.value),
)

const currentAlbum = computed(() => {
  const groups = groupByAlbum(artistTracks.value)
  return groups.find((g) => g.slug === albumSlug.value) ?? null
})

const tracks = computed<LibraryTrack[]>(() => currentAlbum.value?.tracks ?? [])

function playAll() {
  if (tracks.value.length === 0) return
  player.setQueue(tracks.value, 0)
}

function onSelectTrack(index: number) {
  player.setQueue(tracks.value, index)
}

function isCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div class="min-w-0">
          <nav class="flex min-w-0 items-center gap-1 text-sm" aria-label="Навигация">
            <RouterLink :to="{ name: 'artist', params: { artistName } }"
              class="truncate rounded-btn px-1.5 py-0.5 text-fg-muted transition hover:bg-hover-bg hover:text-fg">
              {{ artistName }}
            </RouterLink>
            <span class="shrink-0 text-fg-subtle">/</span>
            <span class="truncate rounded-btn px-1.5 py-0.5 font-medium text-fg">
              {{ currentAlbum?.name ?? 'Альбом' }}
            </span>
          </nav>

          <p v-if="tracks.length > 0" class="px-1.5 text-xs text-fg-muted">
            {{ tracks.length }} треков
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <ShowSourceCheckbox />

          <button v-if="tracks.length > 0" type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="playAll">
            Играть всё
          </button>
        </div>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl">
        <div v-if="tracks.length === 0" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          Альбом не найден
        </div>

        <div v-else class="flex flex-col gap-0.5">
          <TrackListItem v-for="(track, index) in tracks" :key="track.id" :track="track" :index="index"
            :is-current="isCurrent(track.id)" :is-playing="isPlaying" @select="onSelectTrack">
            <template #actions>
              <TrackActions :track="track" />
            </template>
          </TrackListItem>
        </div>
      </div>
    </div>
  </div>
</template>
