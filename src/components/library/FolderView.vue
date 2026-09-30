<!-- src/components/library/FolderView.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { syncService } from '@/services/download/SyncService'
import { toastService } from '@/services/ui/ToastService'
import Breadcrumbs from './Breadcrumbs.vue'
import FolderList from './FolderList.vue'
import TrackList from './TrackList.vue'
import FolderSortMenu from './FolderSortMenu.vue'
import FolderSyncMenu from './FolderSyncMenu.vue'
import FolderCoversMenu from './FolderCoversMenu.vue'
import type { LibraryTrack } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()

const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)

const tracks = computed(() => currentTracks.value)

const hasTracks = computed(() => tracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const isScanning = computed(() => currentFolder.value?.scanStatus === 'scanning')

const subtreeTracks = computed<LibraryTrack[]>(() => {
  const folder = currentFolder.value
  if (!folder) return []
  return library.getAllTracksInFolderRecursive(folder.id)
})

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
      const plugin = await loadPlugin(sourceId)
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
    const plugin = await loadPlugin(folder.source)
    if (!plugin.scanFolder) return

    isRefreshing.value = true
    const context = createPluginContext(folder.source)
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
        <Breadcrumbs />

        <span v-if="currentFolder && !isScanning" class="shrink-0 text-xs text-fg-muted">
          <template v-if="hasFolders">{{ currentSubfolders.length }} папок</template>
          <template v-if="hasFolders && hasTracks"> · </template>
          <template v-if="hasTracks">{{ tracks.length }} треков</template>
          <template v-if="!hasFolders && !hasTracks">пусто</template>
        </span>

        <span v-else-if="isScanning" class="shrink-0 text-xs text-fg-muted">Сканирование…</span>
      </div>
    </div>

    <!-- Шапка: строка 2 -->
    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-2">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <FolderSortMenu />

        <div v-if="!isScanning" class="flex shrink-0 items-center gap-2">
          <!-- Обложки -->
          <FolderCoversMenu :tracks="subtreeTracks" />

          <!-- Синхронизация -->
          <template v-if="canRefresh || canRefreshFromDevice">
            <div class="mx-1 h-4 border-l border-active/40" aria-hidden="true" />
            <FolderSyncMenu :can-refresh="canRefresh" :can-refresh-from-device="canRefreshFromDevice"
              :is-refreshing="isRefreshing" :is-refreshing-from-device="isRefreshingFromDevice"
              @refresh-cloud="refreshFromCloud" @refresh-device="refreshFromDevice" />
          </template>
        </div>
      </div>
    </div>

    <!-- Сканирование -->
    <div v-if="isScanning" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          class="h-8 w-8 animate-spin text-fg">
          <path d="M12 3a9 9 0 019 9" />
        </svg>
        <p class="text-sm text-fg-muted">Сканирование папки…</p>
      </div>
    </div>

    <!-- Контент -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl">
        <div v-if="hasFolders" class="pb-2">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Папки
          </p>
          <FolderList />
        </div>

        <div v-if="hasTracks" class="pb-4">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Треки
          </p>
          <TrackList :key="currentFolder?.id" :tracks="tracks" @select="onSelectTrack" />
        </div>

        <div v-if="!hasFolders && !hasTracks"
          class="flex h-full items-center justify-center py-20 text-sm text-fg-muted">
          В этой папке пусто
        </div>
      </div>
    </div>
  </div>
</template>
