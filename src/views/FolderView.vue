<!-- src/views/FolderView.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { syncService } from '@/services/download/SyncService'
import { toastService } from '@/services/ui/ToastService'
import { sortService } from '@/services/sort/SortService'
import { useMetadataSearch } from '@/composables/useMetadataSearch'
import { useLibrarySearch } from '@/composables/useLibrarySearch'
import FolderBreadcrumbs from '@/components/library/FolderBreadcrumbs.vue'
import FolderList from '@/components/library/FolderList.vue'
import TrackList from '@/components/library/TrackList.vue'
import FolderSortMenu from '@/components/library/FolderSortMenu.vue'
import FolderSyncMenu from '@/components/library/FolderSyncMenu.vue'
import FolderSettingsMenu from '@/components/library/FolderSettingsMenu.vue'
import MetadataMenu from '@/components/library/MetadataMenu.vue'
import MetadataIssuesModal from '@/components/library/MetadataIssuesModal.vue'
import TrackListItem from '@/components/library/TrackListItem.vue'
import TrackActions from '@/components/library/TrackActions.vue'
import FileListItem from '@/components/library/FileListItem.vue'
import TextEditorModal from '@/components/library/TextEditorModal.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import type { LibraryTrack, TextFileRef } from '@/types/library'
import BatchDownloadButton from '@/components/library/BatchDownloadButton.vue'

const library = useLibraryStore()
const player = usePlayerStore()
const uiSettings = useUiSettingsStore()

const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)
const { showFiles } = storeToRefs(uiSettings)

const tracks = computed(() => currentTracks.value)

const hasTracks = computed(() => tracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const isScanning = computed(() => currentFolder.value?.scanStatus === 'scanning')

const subtreeTracks = computed<LibraryTrack[]>(() => {
  const folder = currentFolder.value
  if (!folder) return []
  return library.getAllTracksInFolderRecursive(folder.id)
})

// --- Текстовые файлы (с сортировкой, с учётом showFiles) -------------

const textFiles = computed<TextFileRef[]>(() => {
  if (!showFiles.value) return []
  const files = currentFolder.value?.textFiles ?? []
  return sortService.sortByName(files)
})

const hasTextFiles = computed(() => textFiles.value.length > 0)

const openedFile = ref<TextFileRef | null>(null)

function openFile(file: TextFileRef) {
  openedFile.value = file
}

function closeFile() {
  openedFile.value = null
}

// --- Поиск -----------------------------------------------------------

const { query, hasQuery, hasResults, result } = useLibrarySearch(
  subtreeTracks,
  uiSettings.searchThreshold,
)

const searchFlatTracks = computed<LibraryTrack[]>(() => result.value.tracks)

function onSelectSearchTrack(trackId: string) {
  const idx = searchFlatTracks.value.findIndex((t) => t.id === trackId)
  if (idx < 0) return
  player.setQueue(searchFlatTracks.value, idx)
}

function isSearchCurrent(trackId: string): boolean {
  return currentTrack.value?.id === trackId
}

// --- Поиск метаданных -----------------------------------------------

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

function openMetadataIssues() {
  showMetadataIssues.value = true
}

function closeMetadataIssues() {
  showMetadataIssues.value = false
  metadataDismissIssues()
}

// --- Синхронизация ---------------------------------------------------

const canRefresh = ref(false)
const canRefreshFromDevice = ref(false)

watch(
  () => currentFolder.value?.source,
  async (sourceId) => {
    if (!sourceId) {
      canRefresh.value = false
      canRefreshFromDevice.value = false
      return
    }
    try {
      const plugin = await loadPlugin(pluginIdFromSource(sourceId))
      canRefresh.value = typeof plugin.scanFolder === 'function'
      canRefreshFromDevice.value =
        plugin.canDownload === true && typeof plugin.scanDownloadDir === 'function'
    } catch {
      canRefresh.value = false
      canRefreshFromDevice.value = false
    }
  },
  { immediate: true },
)

const isRefreshing = ref(false)
const isRefreshingFromDevice = ref(false)

async function refreshFromCloud() {
  const folder = currentFolder.value
  if (!folder || !folder.source) return

  try {
    const plugin = await loadPlugin(pluginIdFromSource(folder.source))
    if (!plugin.scanFolder) return

    isRefreshing.value = true
    const context = createPluginContext(pluginIdFromSource(folder.source))
    await plugin.scanFolder(context, folder.id, { recursive: true, removeMissing: true })
    toastService.success('Обновлено с облака')
  } catch (err) {
    console.error('[folder-view] cloud refresh failed', err)
    toastService.error('Не удалось обновить с облака')
  } finally {
    isRefreshing.value = false
  }
}

async function refreshFromDevice() {
  if (isRefreshingFromDevice.value) return

  isRefreshingFromDevice.value = true
  try {
    await syncService.syncAll()
    toastService.info('Сканирование устройства завершено')
  } catch (err) {
    console.error('[folder-view] device refresh failed', err)
    toastService.error('Не удалось обновить с устройства')
  } finally {
    isRefreshingFromDevice.value = false
  }
}

// --- Действия -------------------------------------------------------

function onSelectTrack(index: number) {
  if (isScanning.value) return
  player.setQueue(tracks.value, index)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка: строка 1 -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 pt-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <FolderBreadcrumbs />

        <div class="flex items-center gap-2">
          <span v-if="currentFolder && !isScanning" class="shrink-0 text-xs text-fg-muted">
            <template v-if="hasFolders">{{ currentSubfolders.length }} папок</template>
            <template v-if="hasFolders && hasTracks"> · </template>
            <template v-if="hasTracks">{{ tracks.length }} треков</template>
            <template v-if="!hasFolders && !hasTracks && !hasTextFiles">пусто</template>
          </span>

          <span v-else-if="isScanning" class="shrink-0 text-xs text-fg-muted">Сканирование…</span>

          <BatchDownloadButton :tracks="subtreeTracks" />
        </div>
      </div>
    </div>

    <!-- Шапка: строка 2 -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <SearchInput v-model="query" />
          <FolderSortMenu />
        </div>

        <div v-if="!isScanning" class="flex shrink-0 items-center gap-2">
          <MetadataMenu
            :is-loading="isMetadataLoading"
            :progress="metadataProgress"
            :stats="metadataStats"
            :has-unchecked="metadataHasUnchecked"
            :issues-count="metadataIssues.length"
            @search="metadataSearch"
            @cancel="metadataCancel"
            @reset="metadataReset"
            @open-issues="openMetadataIssues"
          />

          <template v-if="canRefresh || canRefreshFromDevice">
            <FolderSyncMenu
              :can-refresh="canRefresh"
              :can-refresh-from-device="canRefreshFromDevice"
              :is-refreshing="isRefreshing"
              :is-refreshing-from-device="isRefreshingFromDevice"
              @refresh-cloud="refreshFromCloud"
              @refresh-device="refreshFromDevice"
            />
          </template>

          <div class="mx-1 h-4 border-l border-active/40" aria-hidden="true" />

          <FolderSettingsMenu />
        </div>
      </div>
    </div>

    <!-- Сканирование -->
    <div v-if="isScanning" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <IconSpinner class="h-8 w-8 animate-spin text-fg" />
        <p class="text-sm text-fg-muted">Сканирование папки…</p>
      </div>
    </div>

    <!-- Режим поиска -->
    <div v-else-if="hasQuery" class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl p-2">
        <div
          v-if="!hasResults"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted"
        >
          Ничего не найдено
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="flex items-center justify-between gap-3 px-3 py-1">
            <span class="text-xs text-fg-muted">
              Найдено: {{ searchFlatTracks.length }} · Групп: {{ result.groups.length }}
            </span>

            <button
              type="button"
              class="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-bg transition hover:bg-accent-hover"
              @click="player.setQueue(searchFlatTracks, 0)"
            >
              Играть всё
            </button>
          </div>

          <div v-for="group in result.groups" :key="group.artist">
            <p
              class="px-5 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-fg-subtle"
            >
              {{ group.artist }}
            </p>

            <div class="flex flex-col gap-0.5">
              <TrackListItem
                v-for="track in group.tracks"
                :key="track.id"
                :track="track"
                :index="searchFlatTracks.findIndex((t) => t.id === track.id)"
                :is-current="isSearchCurrent(track.id)"
                :is-playing="isPlaying"
                @select="() => onSelectSearchTrack(track.id)"
              >
                <template #actions>
                  <TrackActions :track="track" />
                </template>
              </TrackListItem>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Обычный режим -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl">
        <div v-if="hasFolders" class="pb-2 -ml-2 -mr-2">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Папки
          </p>
          <FolderList />
        </div>

        <div v-if="hasTextFiles" class="pb-4">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Файлы
          </p>
          <div class="flex flex-col gap-0.5">
            <FileListItem
              v-for="file in textFiles"
              :key="file.path"
              :file="file"
              @open="openFile(file)"
            />
          </div>
        </div>

        <div v-if="hasTracks" class="pb-4">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Треки
          </p>
          <TrackList :key="currentFolder?.id" :tracks="tracks" @select="onSelectTrack" />
        </div>

        <div
          v-if="!hasFolders && !hasTracks && !hasTextFiles"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted"
        >
          В этой папке пусто
        </div>
      </div>
    </div>

    <MetadataIssuesModal
      v-if="showMetadataIssues"
      :issues="metadataIssues"
      @close="closeMetadataIssues"
    />

    <TextEditorModal v-if="openedFile" :file="openedFile" @close="closeFile" />
  </div>
</template>
