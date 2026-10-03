<!-- src/views/ArtistView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { filterTracksByArtist, groupByAlbum } from '@/utils/artists'
import { pluralize } from '@/utils/pluralize'
import ShowSourceCheckbox from '@/components/ui/ShowSourceCheckbox.vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const library = useLibraryStore()
const player = usePlayerStore()

const artistName = computed(() => String(route.params.artistName ?? ''))

const artistTracks = computed<LibraryTrack[]>(() =>
  filterTracksByArtist(Object.values(library.tracks), artistName.value),
)

const albums = computed(() => groupByAlbum(artistTracks.value))

const tracksCount = computed(() => artistTracks.value.length)

const albumsPart = computed(() => pluralize(albums.value.length, ['альбом', 'альбома', 'альбомов']))
const tracksPart = computed(() => pluralize(tracksCount.value, ['трек', 'трека', 'треков']))

function playAll() {
  if (artistTracks.value.length === 0) return
  const ordered = albums.value.flatMap((a) => a.tracks)
  player.setQueue(ordered, 0)
}

function playAlbum(group: { tracks: LibraryTrack[] }) {
  if (group.tracks.length === 0) return
  player.setQueue(group.tracks, 0)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-medium text-fg">{{ artistName }}</h1>
          <p class="text-xs text-fg-muted">{{ albumsPart }} · {{ tracksPart }}</p>
        </div>

        <div class="flex shrink-0 items-center gap-3">
          <ShowSourceCheckbox />

          <button
            v-if="tracksCount > 0"
            type="button"
            class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
            @click="playAll"
          >
            Играть всё
          </button>
        </div>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl">
        <div
          v-if="albums.length === 0"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted"
        >
          У этого артиста нет треков
        </div>

        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6"
        >
          <div v-for="group in albums" :key="group.slug" class="group relative">
            <RouterLink
              :to="{ name: 'album', params: { artistName, album: group.slug } }"
              class="block"
            >
              <div class="relative aspect-square overflow-hidden bg-card-bg">
                <img
                  v-if="group.coverUrl"
                  :src="group.coverUrl"
                  :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <IconPlaylist class="h-12 w-12 text-fg-subtle" />
                </div>

                <!-- Play — верхний правый угол -->
                <button
                  type="button"
                  class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                  :aria-label="`Играть альбом ${group.name}`"
                  @click.prevent.stop="playAlbum(group)"
                >
                  <IconPlay class="h-5 w-5 translate-x-[1px]" />
                </button>
              </div>
            </RouterLink>

            <div class="mt-2 min-w-0">
              <RouterLink
                :to="{ name: 'album', params: { artistName, album: group.slug } }"
                class="block truncate text-sm font-medium text-fg transition hover:text-active"
              >
                {{ group.name }}
              </RouterLink>
              <p class="truncate text-xs text-fg-muted">
                {{ pluralize(group.tracks.length, ['трек', 'трека', 'треков']) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
