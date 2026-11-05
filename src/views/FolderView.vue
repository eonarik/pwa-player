<!-- src/views/FolderView.vue -->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { getPluginManifest } from '@/plugins/lookup';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { useLibrarySearch } from '@/composables/useLibrarySearch';
import { useFolderSync } from '@/composables/useFolderSync';
import { useMetadataSearch } from '@/composables/useMetadataSearch';
import { isScanning as isFolderScanning } from '@/utils/folderStatus';
import { toastService } from '@/services/ui/ToastService';
import { getFileHandler } from '@/services/files/FileHandlerRegistry';
import FolderHeader from './folder/FolderHeader.vue';
import FolderFilters from './folder/FolderFilters.vue';
import FolderContent from './folder/FolderContent.vue';
import FileLocationFilter from '@/components/library/FileLocationFilter.vue';
import type { Track } from '@/types/track';
import type { FolderFile } from '@/types/folder';

const library = useLibraryStore();
const player = usePlayerStore();
const uiSettings = useUiSettingsStore();

const { currentTracks, currentFolder, currentSubfolders, subtreeTracksMap } = storeToRefs(library);
const { currentTrack, isPlaying } = storeToRefs(player);
const { showFiles } = storeToRefs(uiSettings);

const tracks = computed(() => currentTracks.value);

const subtreeTracks = computed<Track[]>(() => {
  const folder = currentFolder.value;
  if (!folder) return [];
  return subtreeTracksMap.value.get(folder.id) || [];
});

const {
  isLoading: metadataLoading,
  progress: metadataProgress,
  stats: metadataStats,
  hasUnchecked: metadataHasUnchecked,
  search: searchMetadata,
  cancel: cancelMetadataSearch,
  reset: resetMetadata,
} = useMetadataSearch(computed(() => subtreeTracks.value));

type SourceFilter = 'all' | 'local' | 'cloud';
const sourceFilter = ref<SourceFilter>('all');

const filteredTracks = computed(() => {
  if (sourceFilter.value === 'all') return tracks.value;
  return tracks.value.filter((t) => {
    const hasLocal = t.sources.some((s) => s.kind === 'local');
    const hasCloud = t.sources.some((s) => s.kind === 'cloud');
    if (sourceFilter.value === 'local') return hasLocal;
    return hasCloud;
  });
});

const hasMixedLocations = computed(() => {
  if (filteredTracks.value.length === 0) return false;
  const kinds = new Set<string>();
  for (const t of filteredTracks.value) for (const s of t.sources) kinds.add(s.kind);
  return kinds.has('local') && kinds.has('cloud');
});

const hasTracks = computed(() => filteredTracks.value.length > 0);
const hasFolders = computed(() => currentSubfolders.value.length > 0);

const allFiles = computed<FolderFile[]>(() => {
  const folder = currentFolder.value;
  if (!folder) return [];
  return folder.files || [];
});

const hasFiles = computed(() => allFiles.value.length > 0);

const visibleFiles = computed<FolderFile[]>(() => {
  if (!showFiles.value) return [];
  return allFiles.value;
});

function openFile(file: FolderFile): void {
  const folder = currentFolder.value;
  if (!folder) return;
  const handler = getFileHandler(file.ext);
  if (handler) {
    handler(file, { pluginId: folder.pluginId, folderId: folder.id });
  } else {
    toastService.info(`Нет обработчика для файлов ${file.ext}`);
  }
}

const { query, hasQuery, hasResults, result } = useLibrarySearch(subtreeTracks, uiSettings.searchThreshold);

const searchFlatTracks = computed<Track[]>(() => {
  if (sourceFilter.value === 'all') return result.value.tracks;
  return result.value.tracks.filter((t) => {
    const hasLocal = t.sources.some((s) => s.kind === 'local');
    const hasCloud = t.sources.some((s) => s.kind === 'cloud');
    if (sourceFilter.value === 'local') return hasLocal;
    return hasCloud;
  });
});

function onSelectSearchTrack(trackId: string): void {
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId);
  if (idx < 0) return;
  player.setQueue(searchFlatTracks.value, idx);
}

function playSearchAll(): void {
  if (searchFlatTracks.value.length === 0) return;
  player.playAll(searchFlatTracks.value);
}

const {
  canRefresh,
  canRefreshFromDevice,
  isRefreshing,
  isRefreshingFromDevice,
  isScanning,
  isPluginScanning,
  needsAttention,
  refreshFromCloud,
  refreshFromDevice,
} = useFolderSync(currentFolder);

function onSelectTrack(index: number): void {
  player.setQueue(filteredTracks.value, index);
}

const emptyStateMessage = computed(() => {
  const folder = currentFolder.value;
  if (!folder) return null;
  if (folder.parentId !== null) return null;
  return getPluginManifest(folder.pluginId)?.options?.emptyStateMessage ?? null;
});

const isCurrentFolderScanning = computed(() => isFolderScanning(currentFolder.value));

const hasBackgroundScan = computed(() => {
  if (isPluginScanning.value) return true;
  for (const f of Object.values(library.folders)) {
    if (isFolderScanning(f)) return true;
  }
  return false;
});

async function cancelBackgroundScan(): Promise<void> {
  const folder = currentFolder.value;
  if (!folder) return;

  try {
    const plugin = await loadPlugin(pluginIdFromSource(folder.pluginId));
    if (plugin.cancelBackgroundScan) {
      plugin.cancelBackgroundScan();
      toastService.info('Фоновая синхронизация отменена');
    }
  } catch (err) {
    console.error('[FolderView] failed to cancel background scan', err);
    toastService.error('Не удалось отменить синхронизацию');
  }
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <FolderHeader
      :current-folder="currentFolder"
      :subfolders-count="currentSubfolders.length"
      :tracks-count="filteredTracks.length"
      :files-count="allFiles.length"
      :subtree-tracks="subtreeTracks"
      :is-scanning="isCurrentFolderScanning || isRefreshing"
    />

    <FolderFilters
      v-model:query="query"
      :needs-attention="needsAttention"
      :metadata-loading="metadataLoading"
      :metadata-progress="metadataProgress"
      :metadata-stats="metadataStats"
      :metadata-has-unchecked="metadataHasUnchecked"
      :can-refresh="canRefresh"
      :can-refresh-from-device="canRefreshFromDevice"
      :is-refreshing="isRefreshing"
      :is-refreshing-from-device="isRefreshingFromDevice"
      :is-scanning="isScanning"
      :tracks="filteredTracks"
      :has-background-scan="hasBackgroundScan"
      @metadata-search="searchMetadata"
      @metadata-cancel="cancelMetadataSearch"
      @metadata-reset="resetMetadata"
      @refresh-cloud="refreshFromCloud"
      @refresh-device="refreshFromDevice"
      @cancel-background-scan="cancelBackgroundScan"
    />

    <FolderContent
      :has-folders="hasFolders"
      :has-files="hasFiles"
      :has-tracks="hasTracks"
      :files="visibleFiles"
      :tracks="filteredTracks"
      :empty-state-message="emptyStateMessage"
      :current-folder-id="currentFolder?.id ?? null"
      :is-scanning="isRefreshing"
      :has-query="hasQuery"
      :has-results="hasResults"
      :search-flat-tracks="searchFlatTracks"
      :groups="result.groups"
      :is-playing="isPlaying"
      :current-track-id="currentTrack?.id ?? null"
      @select-track="onSelectTrack"
      @select-search-track="onSelectSearchTrack"
      @open-file="openFile"
      @play-search-all="playSearchAll"
    >
      <template #filters>
        <FileLocationFilter v-if="hasMixedLocations" v-model="sourceFilter" />
      </template>
    </FolderContent>
  </div>
</template>
