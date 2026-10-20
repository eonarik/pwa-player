<!-- src/views/AlbumsView.vue -->
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

interface AlbumGroup {
  album: string
  name: string
  slug: string
  artistDisplay: string
  tracks: LibraryTrack[]
  coverUrl: string | undefined
}

const allAlbums = computed<AlbumGroup[]>(() => {
  const map = new Map<string, LibraryTrack[]>()

  // Группируем только по названию альбома (приводим к нижнему регистру для дедупликации)
  for (const track of Object.values(library.tracks)) {
    const albumName = track.album?.trim() || 'Без альбома'
    const key = albumName.toLowerCase()
    const list = map.get(key) ?? []
    list.push(track)
    map.set(key, list)
  }

  const result: AlbumGroup[] = []

  for (const tracks of map.values()) {
    // Берем оригинальное название (из первого трека)
    const albumName = tracks[0]?.album?.trim() || ''
    const displayName = albumName || 'Без альбома'

    // Сортируем треки внутри альбома по trackNumber, затем по title
    const sortedTracks = [...tracks].sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER
      if (an !== bn) return an - bn
      return a.title.localeCompare(b.title, 'ru')
    })

    // Определяем артиста для отображения
    const uniqueArtists = Array.from(new Set(sortedTracks.map((t) => t.artist?.trim() || 'Неизвестный исполнитель')))
    const multiArtistTitle = uniqueArtists.length > 3 ? `${uniqueArtists.slice(0, 3).join(', ')} и другие...` : uniqueArtists.join(', ')
    const artistDisplay = uniqueArtists.length === 1
      ? uniqueArtists[0]!
      : multiArtistTitle

    // Ищем обложку (первую попавшуюся)
    const coverUrl = sortedTracks.find((t) => t.coverUrl)?.coverUrl

    result.push({
      album: albumName,
      name: displayName,
      slug: albumName ? encodeURIComponent(albumName) : 'no-album', // используется для роутинга
      artistDisplay,
      tracks: sortedTracks,
      coverUrl,
    })
  }

  // Сортируем альбомы по алфавиту
  return result.sort((a, b) => {
    if (!a.album) return 1
    if (!b.album) return -1
    return a.album.localeCompare(b.album, 'ru')
  })
})

function playAlbum(group: AlbumGroup) {
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
          <h1 class="truncate text-lg font-medium text-fg">Альбомы</h1>
          <p class="text-xs text-fg-muted">
            {{ pluralize(allAlbums.length, ['альбом', 'альбома', 'альбомов']) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Контент -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl p-4">
        <div v-if="allAlbums.length === 0" class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          Альбомов пока нет
        </div>

        <div v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6">
          <div v-for="group in allAlbums" :key="group.slug" class="group relative">
            <RouterLink :to="{ name: 'album', params: { artistName: group.artistDisplay, album: group.slug } }"
              class="block">
              <div class="relative aspect-square overflow-hidden bg-card-bg">
                <img v-if="group.coverUrl" :src="group.coverUrl" :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <IconPlaylist class="h-12 w-12 text-fg-subtle" />
                </div>

                <button type="button"
                  class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                  :aria-label="`Играть альбом ${group.name}`" v-tooltip="`Играть альбом ${group.name}`"
                  @click.prevent.stop="playAlbum(group)">
                  <IconPlay class="h-5 w-5 translate-x-[1px]" />
                </button>
              </div>
            </RouterLink>

            <div class="mt-2 min-w-0">
              <!-- Заголовок: до 2 строк -->
              <RouterLink :to="{ name: 'album', params: { artistName: group.artistDisplay, album: group.slug } }"
                class="line-clamp-2 text-sm font-medium text-fg transition hover:text-active" :title="group.name">
                {{ group.name }}
              </RouterLink>
              <!-- Артист: тоже до 2 строк -->
              <p class="line-clamp-2 text-xs text-fg-muted" :title="group.artistDisplay">
                {{ group.artistDisplay }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
