<!-- src/views/PlaylistRoute.vue -->
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlaylistsStore } from '@/stores/playlists'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { usePlaylistRematch } from '@/composables/usePlaylistRematch'
import { useResolvedTracks } from '@/composables/useResolvedTracks'
import { FAVORITES_PLAYLIST_ID } from '@/types/playlist'
import PlaylistHeader from './playlist/PlaylistHeader.vue'
import PlaylistToolbar from './playlist/PlaylistToolbar.vue'
import TrackListPage from '@/components/library/TrackListPage.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import type { LibraryTrack } from '@/types/library'
import { useLibraryStore } from "@/stores/library/store.ts"

const route = useRoute()
const router = useRouter()
const playlists = usePlaylistsStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { isPlaying } = storeToRefs(player)

const playlistId = computed(() => String(route.params.id))
const playlist = computed(() => playlists.getPlaylist(playlistId.value))
const isFavorites = computed(() => playlistId.value === FAVORITES_PLAYLIST_ID)

const snapshots = computed(() => playlist.value?.tracks ?? [])
const resolvedTracks = useResolvedTracks(snapshots)

const unavailableCount = computed(() => {
  if (!playlist.value) return 0
  return playlist.value.tracks.length - resolvedTracks.value.length
})

const { rematch } = usePlaylistRematch(playlist)

onMounted(() => {
  rematch()
})

// Метаданные
const searchableTracks = computed<LibraryTrack[]>(() => {
  // В PlaylistRoute фильтрация теперь внутри TrackListPage,
  // но для поиска метаданных нам нужны все доступные треки из библиотеки
  return resolvedTracks.value.filter((t): t is LibraryTrack => Boolean(useLibraryStore().getTrack(t.id)))
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
      <!-- Используем новый TrackListPage -->
      <TrackListPage :title="playlist.name" :subtitle="`${resolvedTracks.length} из ${playlist.tracks.length}`"
        :tracks="playlist.tracks" :is-snapshot="true" :show-search="true" :show-filter="true" :show-play-all="true"
        :show-batch-add="true">

        <!-- Кнопки в шапке (Ренейм, Удалить, Поделиться) -->
        <template #header-actions>
          <PlaylistHeader :playlist="playlist" :is-favorites="isFavorites" :resolved-tracks="resolvedTracks"
            :unavailable-count="unavailableCount" @rename="onRename" @delete="onDelete" />
        </template>

        <!-- Метаданные трека (если нужны) -->
        <template #track-meta>
          <!-- Тут можно вывести дату добавления, если нужно -->
        </template>
      </TrackListPage>

      <!-- Панель метаданных (поиск, очистка) -->
      <div class="shrink-0 border-t border-hover-bg bg-bg pb-2">
        <div class="mx-auto w-full max-w-3xl">
          <PlaylistToolbar :query="''" :is-favorites="isFavorites" :metadata-loading="isMetadataLoading"
            :metadata-progress="metadataProgress" :metadata-stats="metadataStats"
            :metadata-has-unchecked="metadataHasUnchecked" :metadata-issues-count="metadataIssues.length"
            @metadata-search="metadataSearch" @metadata-cancel="metadataCancel" @metadata-reset="metadataReset"
            @open-issues="openMetadataIssues" @delete="onDelete" />
        </div>
      </div>

      <MetadataIssuesModal v-if="showMetadataIssues" :issues="metadataIssues" @close="closeMetadataIssues" />
    </template>
  </div>
</template>
