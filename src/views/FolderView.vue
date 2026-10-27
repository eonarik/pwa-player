<!-- src/views/FolderView.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getPluginManifest } from '@/plugins/lookup'
import { sortService } from '@/services/sort/SortService'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { useFolderSync } from '@/composables/useFolderSync'
import FileLocationFilter, { type SourceFilter } from '@/components/library/FileLocationFilter.vue'
import FolderHeader from './folder/FolderHeader.vue'
import FolderFilters from './folder/FolderFilters.vue'
import FolderContent from './folder/FolderContent.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import TextEditorModal from '@/components/library/TextEditorModal.vue'
import type { LibraryTrack, TextFileRef } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)
const { showFiles } = storeToRefs(uiSettings)

const tracks = computed(() => currentTracks.value)
const sourceFilter = ref<SourceFilter>('all')

// Фильтрация треков
const filteredTracks = computed(() => {
  if (sourceFilter.value === 'all') return tracks.value
  return tracks.value.filter((t) => {
    const loc = t.fileLocation ?? 'remote-only'
    if (sourceFilter.value === 'local') {
      return loc === 'local-only' || loc === 'both'
    }
    return loc === 'remote-only' || loc === 'both'
  })
})

const hasTracks = computed(() => filteredTracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const isScanning = computed(() => currentFolder.value?.scanState === 'scanning')

const subtreeTracks = computed<LibraryTrack[]>(() => {
  const folder = currentFolder.value
  if (!folder) return []
  return library.getAllTracksInFolderRecursive(folder.id)
})

const textFiles = computed<TextFileRef[]>(() => {
  if (!showFiles.value) return []
  const files = currentFolder.value?.textFiles ?? []
  return sortService.sortByName(files)
})

const hasTextFiles = computed(() => textFiles.value.length > 0)
const openedFile = ref<TextFileRef | null>(null)

function openFile(file: TextFileRef): void {
  openedFile.value = file
}

function closeFile(): void {
  openedFile.value = null
}

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  subtreeTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<LibraryTrack[]>(() => {
  if (sourceFilter.value === 'all') return result.value.tracks
  return result.value.tracks.filter((t) => {
    const loc = t.fileLocation ?? 'remote-only'
    if (sourceFilter.value === 'local') {
      return loc === 'local-only' || loc === 'both'
    }
    return loc === 'remote-only' || loc === 'both'
  })
})

function onSelectSearchTrack(trackId: string): void {
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(searchFlatTracks.value, idx)
}

function playSearchAll(): void {
  if (searchFlatTracks.value.length === 0) return
  player.playAll(searchFlatTracks.value)
}

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
} = useMetadataSearch(subtreeTracks)

const showMetadataIssues = ref(false)

function openMetadataIssues(): void {
  showMetadataIssues.value = true
}

function closeMetadataIssues(): void {
  showMetadataIssues.value = false
  metadataDismissIssues()
}

const {
  canRefresh,
  canRefreshFromDevice,
  isRefreshing,
  isRefreshingFromDevice,
  needsAttention,
  refreshFromCloud,
  refreshFromDevice,
} = useFolderSync(currentFolder)

function onSelectTrack(index: number): void {
  if (isScanning.value) return
  player.setQueue(filteredTracks.value, index)
}

const emptyStateMessage = computed(() => {
  const folder = currentFolder.value
  if (!folder || !folder.source) return null
  if (folder.parentId !== null) return null
  return getPluginManifest(folder.source)?.options?.emptyStateMessage ?? null
})
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <FolderHeader :current-folder="currentFolder" :subfolders-count="currentSubfolders.length"
      :tracks-count="filteredTracks.length" :files-count="textFiles.length" :subtree-tracks="subtreeTracks"
      :is-scanning="isScanning" />

    <FolderFilters v-model:query="query" :needs-attention="needsAttention" :metadata-loading="isMetadataLoading"
      :metadata-progress="metadataProgress" :metadata-stats="metadataStats"
      :metadata-has-unchecked="metadataHasUnchecked" :metadata-issues-count="metadataIssues.length"
      :can-refresh="canRefresh" :can-refresh-from-device="canRefreshFromDevice" :is-refreshing="isRefreshing"
      :is-refreshing-from-device="isRefreshingFromDevice" @metadata-search="metadataSearch"
      @metadata-cancel="metadataCancel" @metadata-reset="metadataReset" @open-issues="openMetadataIssues"
      @refresh-cloud="refreshFromCloud" @refresh-device="refreshFromDevice" />

    <FolderContent :has-folders="hasFolders" :has-text-files="hasTextFiles" :has-tracks="hasTracks"
      :text-files="textFiles" :tracks="filteredTracks" :empty-state-message="emptyStateMessage"
      :current-folder-id="currentFolder?.id ?? null" :is-scanning="isScanning" :has-query="hasQuery"
      :has-results="hasResults" :search-flat-tracks="searchFlatTracks" :groups="result.groups" :is-playing="isPlaying"
      :current-track-id="currentTrack?.id ?? null" @select-track="onSelectTrack"
      @select-search-track="onSelectSearchTrack" @open-file="openFile" @play-search-all="playSearchAll">
      <template #filters>
        <FileLocationFilter v-model="sourceFilter" />
      </template>
    </FolderContent>

    <MetadataIssuesModal v-if="showMetadataIssues" :issues="metadataIssues" @close="closeMetadataIssues" />

    <TextEditorModal v-if="openedFile" :file="openedFile" :plugin-id="currentFolder?.source" @close="closeFile" />
  </div>
</template>
