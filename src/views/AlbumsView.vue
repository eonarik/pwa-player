<!-- src/views/AlbumsView.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { pluralize } from '@/utils/pluralize'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Icon from '@/components/ui/Icon.vue'
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

  for (const track of Object.values(library.tracks)) {
    const albumName = track.album?.trim() || 'Без альбома'
    const key = albumName.toLowerCase()
    const list = map.get(key) ?? []
    list.push(track)
    map.set(key, list)
  }

  const result: AlbumGroup[] = []

  for (const tracks of map.values()) {
    const albumName = tracks[0]?.album?.trim() || ''
    const displayName = albumName || 'Без альбома'

    const sortedTracks = [...tracks].sort((a, b) => {
      const an = a.trackNumber ?? Number.MAX_SAFE_INTEGER
      const bn = b.trackNumber ?? Number.MAX_SAFE_INTEGER
      if (an !== bn) return an - bn
      return a.title.localeCompare(b.title, 'ru')
    })

    const uniqueArtists = Array.from(new Set(sortedTracks.map((t) => t.artist?.trim() || 'Неизвестный исполнитель')))
    const multiArtistTitle = uniqueArtists.length > 3 ? `${uniqueArtists.slice(0, 3).join(', ')} и другие...` : uniqueArtists.join(', ')
    const artistDisplay = uniqueArtists.length === 1 ? uniqueArtists[0]! : multiArtistTitle

    const coverUrl = sortedTracks.find((t) => t.coverUrl)?.coverUrl

    result.push({
      album: albumName,
      name: displayName,
      slug: albumName ? encodeURIComponent(albumName) : 'no-album',
      artistDisplay,
      tracks: sortedTracks,
      coverUrl,
    })
  }

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
    <PageHeader title="Альбомы" :subtitle="pluralize(allAlbums.length, ['альбом', 'альбома', 'альбомов'])"
      max-width="lg" />

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-5xl py-4">
        <EmptyState v-if="allAlbums.length === 0" title="Альбомов пока нет">
          <template #icon>
            <Icon name="playlist" w="w-10" h="h-10" />
          </template>
        </EmptyState>

        <div v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 lg:gap-6 px-4">
          <div v-for="group in allAlbums" :key="group.slug" class="group relative">
            <RouterLink :to="{ name: 'album', params: { artistName: group.artistDisplay, album: group.slug } }"
              class="block">
              <div class="relative aspect-square overflow-hidden bg-card-bg">
                <img v-if="group.coverUrl" :src="group.coverUrl" :alt="group.name"
                  class="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <Icon name="playlist" w="w-12" h="h-12" class="text-fg-subtle" />
                </div>

                <button type="button"
                  class="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-bg opacity-100 shadow-lg transition hover:scale-105 md:opacity-0 md:group-hover:opacity-100"
                  :aria-label="`Играть альбом ${group.name}`" @click.prevent.stop="playAlbum(group)">
                  <Icon name="play" w="w-5" h="h-5" class="translate-x-[1px]" />
                </button>
              </div>
            </RouterLink>

            <div class="mt-2 min-w-0">
              <RouterLink :to="{ name: 'album', params: { artistName: group.artistDisplay, album: group.slug } }"
                class="line-clamp-2 text-sm font-medium text-fg transition hover:text-active" :title="group.name">
                {{ group.name }}
              </RouterLink>
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
