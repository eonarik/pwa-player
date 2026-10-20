<!-- src/views/ArtistsView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { pluralize } from '@/utils/pluralize'
import IconPlaylist from '@/components/icons/IconPlaylist.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
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
    // Считаем уникальные альбомы
    const albums = new Set(tracks.map((t) => t.album?.trim() || 'Без альбома'))

    // Ищем обложку: берем первый трек, у которого есть coverUrl
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
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
      <div class="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <div class="min-w-0">
          <h1 class="truncate text-lg font-medium text-fg">Исполнители</h1>
          <p class="text-xs text-fg-muted">
            {{ pluralize(allArtists.length, ['исполнитель', 'исполнителя', 'исполнителей']) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl p-4">
        <div v-if="allArtists.length === 0" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          Исполнителей пока нет
        </div>

        <div v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6">
          <div v-for="group in allArtists" :key="group.name" class="group relative">
            <RouterLink :to="{ name: 'artist', params: { artistName: group.name } }" class="block">
              <!-- Круглый контейнер с overflow-hidden -->
              <div class="relative aspect-square overflow-hidden rounded-full bg-card-bg">
                <img v-if="group.coverUrl" :src="group.coverUrl" :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <IconPlaylist class="h-12 w-12 text-fg-subtle" />
                </div>

                <!-- Оверлей + кнопка по центру -->
                <div
                  class="absolute inset-0 flex items-center justify-center bg-bg/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <button type="button"
                    class="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg shadow-lg transition hover:scale-105"
                    :aria-label="`Играть треки ${group.name}`" v-tooltip="`Играть треки ${group.name}`"
                    @click.prevent.stop="playArtist(group)">
                    <IconPlay class="h-5 w-5 translate-x-[1px]" />
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
