<!-- src/views/FolderView.vue -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getPluginManifest } from '@/plugins/lookup'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { sortService } from '@/services/sort/SortService'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import { useFolderSync } from '@/composables/useFolderSync'
import { folderStatusService } from '@/services/folders/FolderStatusService'
import { toastService } from '@/services/ui/ToastService'
import FolderHeader from './folder/FolderHeader.vue'
import FolderFilters from './folder/FolderFilters.vue'
import FolderContent from './folder/FolderContent.vue'
import FileLocationFilter from '@/components/library/FileLocationFilter.vue'
import TextEditorModal from '@/components/library/TextEditorModal.vue'
import type { Track } from '@/types/track'
import type { TextFileRef } from '@/plugins/types'
import type { FolderId } from '@/types/ids'

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)
const { showFiles } = storeToRefs(uiSettings)

const tracks = computed(() => currentTracks.value)

type SourceFilter = 'all' | 'local' | 'cloud'
const sourceFilter = ref<SourceFilter>('all')

const filteredTracks = computed(() => {
  if (sourceFilter.value === 'all') return tracks.value
  return tracks.value.filter((t) => {
    const hasLocal = t.sources.some((s) => s.kind === 'local')
    const hasCloud = t.sources.some((s) => s.kind === 'cloud')
    if (sourceFilter.value === 'local') return hasLocal
    return hasCloud
  })
})

const hasMixedLocations = computed(() => {
  if (filteredTracks.value.length === 0) return false
  const kinds = new Set<string>()
  for (const t of filteredTracks.value) for (const s of t.sources) kinds.add(s.kind)
  return kinds.has('local') && kinds.has('cloud')
})

const hasTracks = computed(() => filteredTracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const textFiles = ref<TextFileRef[]>([])

async function refreshTextFiles() {
  const folder = currentFolder.value
  if (!folder || !showFiles.value) {
    textFiles.value = []
    return
  }
  try {
    const plugin = await loadPlugin(pluginIdFromSource(folder.pluginId))
    if (plugin.getTextFiles) {
      const files = await plugin.getTextFiles(createPluginContext(folder.pluginId), folder.id)
      textFiles.value = sortService.sortByName(files)
    } else {
      textFiles.value = []
    }
  } catch {
    textFiles.value = []
  }
}

watch([currentFolder, showFiles], () => {
  void refreshTextFiles()
}, { immediate: true })

const hasTextFiles = computed(() => textFiles.value.length > 0)
const openedFile = ref<TextFileRef | null>(null)

function openFile(file: TextFileRef): void {
  openedFile.value = file
}

function closeFile(): void {
  openedFile.value = null
}

const subtreeTracks = computed<Track[]>(() => {
  const folder = currentFolder.value
  if (!folder) return []
  const ids = library.tracksByFolderId[folder.id] ?? []
  return ids.map((id) => library.getTrack(id)).filter((t): t is Track => Boolean(t))
})

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  subtreeTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<Track[]>(() => {
  if (sourceFilter.value === 'all') return result.value.tracks
  return result.value.tracks.filter((t) => {
    const hasLocal = t.sources.some((s) => s.kind === 'local')
    const hasCloud = t.sources.some((s) => s.kind === 'cloud')
    if (sourceFilter.value === 'local') return hasLocal
    return hasCloud
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
  canRefresh,
  canRefreshFromDevice,
  isRefreshing,
  isRefreshingFromDevice,
  needsAttention,
  refreshFromCloud,
  refreshFromDevice,
} = useFolderSync(currentFolder)

function onSelectTrack(index: number): void {
  player.setQueue(filteredTracks.value, index)
}

const emptyStateMessage = computed(() => {
  const folder = currentFolder.value
  if (!folder) return null
  if (folder.parentId !== null) return null
  return getPluginManifest(folder.pluginId)?.options?.emptyStateMessage ?? null
})

// --- Статусы и отмена фонового скана ---------------------------------

const isCurrentFolderScanning = computed(() => {
  const folder = currentFolder.value
  if (!folder) return false
  return folderStatusService.isScanning(folder.id)
})

const hasBackgroundScan = computed(() => {
  const folder = currentFolder.value
  if (!folder) return false

  const walk = (id: FolderId): boolean => {
    if (folderStatusService.needsScan(id) || folderStatusService.isScanning(id)) return true
    return Object.values(library.folders)
      .filter((f) => f.parentId === id)
      .some((f) => walk(f.id))
  }
  return walk(folder.id)
})

async function cancelBackgroundScan(): Promise<void> {
  const folder = currentFolder.value
  if (!folder) return

  try {
    const plugin = await loadPlugin(pluginIdFromSource(folder.pluginId))
    if (plugin.cancelBackgroundScan) {
      plugin.cancelBackgroundScan()
      toastService.info('Фоновая синхронизация отменена')
    }
  } catch (err) {
    console.error('[FolderView] failed to cancel background scan', err)
    toastService.error('Не удалось отменить синхронизацию')
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <FolderHeader :current-folder="currentFolder" :subfolders-count="currentSubfolders.length"
      :tracks-count="filteredTracks.length" :files-count="textFiles.length" :subtree-tracks="subtreeTracks"
      :is-scanning="isCurrentFolderScanning || isRefreshing" />

    <FolderFilters v-model:query="query" :needs-attention="needsAttention" :metadata-loading="false"
      :metadata-progress="{ done: 0, total: 0 }" :metadata-stats="{ found: 0, checked: 0, total: 0 }"
      :metadata-has-unchecked="false" :metadata-issues-count="0" :can-refresh="canRefresh"
      :can-refresh-from-device="canRefreshFromDevice" :is-refreshing="isRefreshing"
      :is-refreshing-from-device="isRefreshingFromDevice" :tracks="filteredTracks"
      :has-background-scan="hasBackgroundScan"
      @metadata-search="() => { }" @metadata-cancel="() => { }" @metadata-reset="() => { }"
      @open-issues="() => { }" @refresh-cloud="refreshFromCloud" @refresh-device="refreshFromDevice"
      @cancel-background-scan="cancelBackgroundScan" />

    <FolderContent :has-folders="hasFolders" :has-text-files="hasTextFiles" :has-tracks="hasTracks"
      :text-files="textFiles" :tracks="filteredTracks" :empty-state-message="emptyStateMessage"
      :current-folder-id="currentFolder?.id ?? null" :is-scanning="isRefreshing" :has-query="hasQuery"
      :has-results="hasResults" :search-flat-tracks="searchFlatTracks" :groups="result.groups" :is-playing="isPlaying"
      :current-track-id="currentTrack?.id ?? null" @select-track="onSelectTrack"
      @select-search-track="onSelectSearchTrack" @open-file="openFile" @play-search-all="playSearchAll">
      <template #filters>
        <FileLocationFilter v-if="hasMixedLocations" v-model="sourceFilter" />
      </template>
    </FolderContent>

    <TextEditorModal v-if="openedFile && currentFolder" :file="openedFile" :plugin-id="currentFolder.pluginId"
      @close="closeFile" />
  </div>
</template>
