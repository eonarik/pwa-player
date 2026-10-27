<!-- src/views/PlaylistRoute.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistsStore } from '@/stores/playlists'
import { useLibraryStore } from '@/stores/library'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import PlaylistHeader from './playlist/PlaylistHeader.vue'
import TrackListPage from '@/components/library/TrackListPage.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import MetadataMenu from '@/components/library/MetadataMenu.vue'
import type { LibraryTrack } from '@/types/library'

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const library = useLibraryStore()

const playlistId = computed(() => String(route.params.id))
const playlist = computed(() => playlists.getPlaylist(playlistId.value))
const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID)

// Берем треки напрямую из библиотеки
const resolvedTracks = computed(() => {
  if (!playlist.value) return []
  return playlist.value.trackIds
    .map(id => library.getTrack(id))
    .filter((t): t is LibraryTrack => Boolean(t))
})

const unavailableCount = computed(() => {
  if (!playlist.value) return 0
  return playlist.value.trackIds.length - resolvedTracks.value.length
})

// Метаданные
const searchableTracks = computed<LibraryTrack[]>(() => {
  return resolvedTracks.value.filter((t): t is LibraryTrack => Boolean(library.getTrack(t.id)))
})

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
      <TrackListPage :title="playlist.name" :subtitle="`${resolvedTracks.length} из ${playlist.trackIds.length}`"
        :tracks="resolvedTracks" :is-snapshot="false" :show-search="true" :show-filter="true" :show-play-all="true"
        :show-batch-add="true">

        <template #header-actions>
          <MetadataMenu :is-loading="isMetadataLoading" :progress="metadataProgress" :stats="metadataStats"
            :has-unchecked="metadataHasUnchecked" :issues-count="metadataIssues.length" @search="metadataSearch"
            @cancel="metadataCancel" @reset="metadataReset" @open-issues="openMetadataIssues" />

          <PlaylistHeader :playlist="playlist" :is-favorites="isFavorites" :resolved-tracks="resolvedTracks"
            :unavailable-count="unavailableCount" @rename="onRename" @delete="onDelete" />
        </template>
      </TrackListPage>

      <MetadataIssuesModal v-if="showMetadataIssues" :issues="metadataIssues" @close="closeMetadataIssues" />
    </template>
  </div>
</template>
