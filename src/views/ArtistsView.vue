<!-- src/views/ArtistsView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { pluralize } from '@/utils/pluralize'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import type { LibraryTrack } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()

interface ArtistGroup {
  name: string
  tracks: LibraryTrack[]
  albumsCount: number
  coverUrl: string | undefined
}

const allArtists = computed<ArtistGroup[]>(() => {
  const map = new Map<string, LibraryTrack[]>()

  for (const track of Object.values(library.tracks)) {
    const artist = track.artist?.trim() || 'Неизвестный исполнитель'
    const list = map.get(artist) ?? []
    list.push(track)
    map.set(artist, list)
  }

  const result: ArtistGroup[] = []

  for (const [name, tracks] of map) {
    const albums = new Set(tracks.map((t) => t.album?.trim() || 'Без альбома'))
    const coverUrl = tracks.find((t) => t.coverUrl)?.coverUrl

    result.push({
      name,
      tracks,
      albumsCount: albums.size,
      coverUrl,
    })
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})

function playArtist(group: ArtistGroup) {
  if (group.tracks.length === 0) return
  player.setQueue(group.tracks, 0)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PageHeader title="Исполнители"
      :subtitle="pluralize(allArtists.length, ['исполнитель', 'исполнителя', 'исполнителей'])" max-width="lg" />

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl p-4">
        <EmptyState v-if="allArtists.length === 0" :icon="IconPlaylist" title="Исполнителей пока нет" />

        <div v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6">
          <div v-for="group in allArtists" :key="group.name" class="group relative">
            <RouterLink :to="{ name: 'artist', params: { artistName: group.name } }" class="block">
              <div class="relative aspect-square overflow-hidden rounded-full bg-card-bg">
                <img v-if="group.coverUrl" :src="group.coverUrl" :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <Icon name="playlist" w="w-12" h="h-12" class="text-fg-subtle" />
                </div>

                <div
                  class="absolute inset-0 flex items-center justify-center bg-bg/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button type="button"
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg shadow-lg transition hover:scale-105"
                    :aria-label="`Играть треки ${group.name}`" @click.prevent.stop="playArtist(group)">
                    <Icon name="play" w="w-5" h="h-5" class="translate-x-[1px]" />
                  </button>
                </div>
              </div>
            </RouterLink>

            <div class="mt-2 min-w-0 text-center">
              <RouterLink :to="{ name: 'artist', params: { artistName: group.name } }"
                class="line-clamp-1 text-sm font-medium text-fg transition hover:text-active" :title="group.name">
                {{ group.name }}
              </RouterLink>
              <p class="line-clamp-1 text-xs text-fg-muted">
                {{ pluralize(group.albumsCount, ['альбом', 'альбома', 'альбомов']) }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
