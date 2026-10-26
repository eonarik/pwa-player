<!-- src/views/PlaylistRoute.vue -->
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { usePlaylistRematch } from '@/composables/usePlaylistRematch'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import { compareStrings } from '@/utils/sort'
import PlaylistHeader from './playlist/PlaylistHeader.vue'
import PlaylistToolbar from './playlist/PlaylistToolbar.vue'
import PlaylistContent from './playlist/PlaylistContent.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import type { Track } from '@/types/track'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTrack, isPlaying } = storeToRefs(player)

const playlistId = computed(() => String(route.params.id))
const playlist = computed(() => playlists.getPlaylist(playlistId.value))

const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID)

// Собираем треки для отображения и воспроизведения.
// Если трек есть в библиотеке — берем его.
// Если нет (стриминг) — собираем виртуальный Track из снимка.
const resolvedTracks = computed<Track[]>(() => {
  if (!playlist.value) return []
  const result: Track[] = []

  for (const snapshot of playlist.value.tracks) {
    const libTrack = library.getTrack(snapshot.trackId)

    if (libTrack) {
      result.push(libTrack)
    } else if (snapshot.source) {
      result.push({
        id: snapshot.trackId,
        pluginId: snapshot.pluginId,
        title: snapshot.title,
        artist: snapshot.artist,
        album: snapshot.album ?? '',
        duration: snapshot.duration ?? 0,
        coverUrl: snapshot.coverUrl,
        filename: '',
        source: snapshot.source,
      })
    }
  }

  // Сортируем по названию, так как sortService ожидает LibraryTrack
  return result.sort((a, b) => compareStrings(a.title, b.title))
})

const unavailableCount = computed(() => {
  if (!playlist.value) return 0
  return playlist.value.tracks.length - resolvedTracks.value.length
})

// --- Пересопоставление -----------------------------------------------

const { rematch } = usePlaylistRematch(playlist)

onMounted(() => {
  rematch()
})

// --- Поиск -----------------------------------------------------------

// Фильтруем только те треки, которые есть в библиотеке (для поиска)
const searchableTracks = computed<LibraryTrack[]>(() => {
  return resolvedTracks.value.filter((t): t is LibraryTrack => {
    return Boolean(library.getTrack(t.id))
  })
})

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  searchableTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<Track[]>(() => result.value.tracks)

// --- Поиск метаданных -----------------------------------------------

// Метаданные ищем только для треков из библиотеки
const {
  isLoading: isMetadataLoading,
  progress: metadataProgress,
  stats: metadataStats,
  hasUnchecked: metadataHasUnchecked,
  issues: metadataIssues,
  search: metadataSearch,
  cancel: metadataCancel,
  reset: metadataReset,
  dismissIssues: metadataDismissIssues,
} = useMetadataSearch(searchableTracks)

const showMetadataIssues = ref(false)

function openMetadataIssues(): void {
  showMetadataIssues.value = true
}

function closeMetadataIssues(): void {
  showMetadataIssues.value = false
  metadataDismissIssues()
}

// --- Действия -------------------------------------------------------

function onRename(value: string): void {
  if (!playlist.value) return
  playlists.renamePlaylist(playlist.value.id, value)
}

function onDelete(): void {
  if (!playlist.value || isFavorites.value) return
  const confirmed = window.confirm(`Удалить плейлист «${playlist.value.name}»?`)
  if (!confirmed) return
  playlists.deletePlaylist(playlist.value.id)
  router.replace({ name: 'playlists' })
}

function onSelectTrack(index: number): void {
  if (index < 0) return
  player.setQueue(resolvedTracks.value, index)
}

function onSelectSearchTrack(trackId: string): void {
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(searchFlatTracks.value, idx)
}

function onRemoved(): void {
  // стор пересчитается сам
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div v-if="!playlist" class="flex h-full flex-col items-center justify-center gap-3 text-sm text-fg-muted">
      <p>Плейлист не найден</p>
      <RouterLink :to="{ name: 'playlists' }"
        class="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-bg transition hover:bg-accent-hover">
        К плейлистам
      </RouterLink>
    </div>

    <template v-else>
      <PlaylistHeader :playlist="playlist" :is-favorites="isFavorites" :resolved-tracks="resolvedTracks"
        :unavailable-count="unavailableCount" @rename="onRename" />

      <PlaylistToolbar v-model:query="query" :is-favorites="isFavorites" :metadata-loading="isMetadataLoading"
        :metadata-progress="metadataProgress" :metadata-stats="metadataStats"
        :metadata-has-unchecked="metadataHasUnchecked" :metadata-issues-count="metadataIssues.length"
        @metadata-search="metadataSearch" @metadata-cancel="metadataCancel" @metadata-reset="metadataReset"
        @open-issues="openMetadataIssues" @delete="onDelete" />

      <PlaylistContent :playlist="playlist" :resolved-tracks="resolvedTracks" :is-playing="isPlaying"
        :current-track-id="currentTrack?.id ?? null" :has-query="hasQuery" :has-results="hasResults"
        :search-flat-tracks="searchFlatTracks" :groups="result.groups" @select-track="onSelectTrack"
        @select-search-track="onSelectSearchTrack" @removed="onRemoved" />

      <MetadataIssuesModal v-if="showMetadataIssues" :issues="metadataIssues" @close="closeMetadataIssues" />
    </template>
  </div>
</template>
