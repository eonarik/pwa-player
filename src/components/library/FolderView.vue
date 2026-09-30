<!-- src/components/library/FolderView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { syncService } from '@/services/download/SyncService'
import { toastService } from '@/services/ui/ToastService'
import { FIELD_LABELS, sortService, type SortField } from '@/services/sort/SortService'
import Breadcrumbs from './Breadcrumbs.vue'
import FolderList from './FolderList.vue'
import TrackList from './TrackList.vue'
import CoverSearchButton from './CoverSearchButton.vue'
import type { LibraryTrack } from '@/types/library'

const library = useLibraryStore()
const player = usePlayerStore()

const { currentTracks, currentFolder, currentSubfolders } = storeToRefs(library)

const tracks = computed(() => currentTracks.value)

const hasTracks = computed(() => tracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const isScanning = computed(() => currentFolder.value?.scanStatus === 'scanning')

/** Треки поддерева текущей папки — для поиска обложек */
const subtreeTracks = computed<LibraryTrack[]>(() => {
  const folder = currentFolder.value
  if (!folder) return []
  return library.getAllTracksInFolderRecursive(folder.id)
})

// --- Меню сортировки -------------------------------------------------

const isSortMenuOpen = ref(false)

function selectSortField(field: SortField) {
  sortService.setField(field)
  isSortMenuOpen.value = false
}

// --- Обновление источника -------------------------------------------

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

const isRefreshMenuOpen = ref(false)
const isRefreshing = ref(false)
const isRefreshingFromDevice = ref(false)

function toggleRefreshMenu() {
  isRefreshMenuOpen.value = !isRefreshMenuOpen.value
}

function closeRefreshMenu() {
  isRefreshMenuOpen.value = false
}

async function refreshFromCloud() {
  closeRefreshMenu()

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
  closeRefreshMenu()

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

// --- Закрытие меню по клику снаружи ---------------------------------

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement

  if (!target.closest('[data-refresh-menu]')) {
    closeRefreshMenu()
  }
  if (!target.closest('[data-sort-menu]')) {
    isSortMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

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
        <div class="flex items-center gap-3">
          <!-- Сортировка -->
          <div class="flex items-center gap-1">
            <!-- Кнопка выбора поля -->
            <div data-sort-menu class="relative">
              <button type="button"
                class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
                @click.stop="isSortMenuOpen = !isSortMenuOpen">
                <span>{{ FIELD_LABELS[sortService.field.value] }}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
                  :class="isSortMenuOpen ? 'rotate-180' : ''">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <!-- Dropdown -->
              <div v-if="isSortMenuOpen"
                class="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden bg-bg-elevated shadow-lg">
                <button v-for="(label, field) in FIELD_LABELS" :key="field" type="button"
                  class="block w-full px-3 py-2 text-left text-xs text-fg transition hover:bg-hover-bg"
                  :class="sortService.field.value === field ? 'bg-active/10 text-active' : ''"
                  @click="selectSortField(field)">
                  {{ label }}
                </button>
              </div>
            </div>

            <!-- Кнопка направления -->
            <button type="button"
              class="flex items-center gap-1 rounded-btn bg-card-bg px-2 py-1.5 text-xs text-fg transition hover:bg-hover-bg"
              :aria-label="sortService.dirLabel" :title="sortService.dirLabel" @click="sortService.toggleDir()">
              <svg v-if="sortService.dir.value === 'asc'" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" class="h-3.5 w-3.5">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <!-- Поиск обложек -->
          <CoverSearchButton v-if="!isScanning" :tracks="subtreeTracks" />

          <!-- Действия -->
          <template v-if="!isScanning && (canRefresh || canRefreshFromDevice)">
            <div class="mx-1 h-4 border-l border-active/40" aria-hidden="true" />
            <div data-refresh-menu class="relative">
              <button type="button"
                class="flex items-center gap-1 rounded-btn bg-card-bg px-3 py-1.5 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
                :disabled="isRefreshing || isRefreshingFromDevice" @click.stop="toggleRefreshMenu">
                <span v-if="isRefreshing">Обновление…</span>
                <span v-else-if="isRefreshingFromDevice">Сканирование…</span>
                <span v-else>Действия</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
                  :class="isRefreshMenuOpen ? 'rotate-180' : ''">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <div v-if="isRefreshMenuOpen"
                class="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden bg-bg-elevated shadow-lg">
                <button v-if="canRefresh" type="button"
                  class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
                  @click="refreshFromCloud">
                  Обновить с облака
                  <span class="block text-[10px] text-fg-muted">
                    Синхронизировать треки с Яндекс.Диска
                  </span>
                </button>

                <button v-if="canRefreshFromDevice" type="button"
                  class="block w-full px-4 py-2.5 text-left text-sm text-fg transition hover:bg-hover-bg"
                  @click="refreshFromDevice">
                  Обновить с устройства
                  <span class="block text-[10px] text-fg-muted">
                    Найти новые и отсутствующие файлы
                  </span>
                </button>
              </div>
            </div>
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
