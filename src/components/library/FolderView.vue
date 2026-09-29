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
import Breadcrumbs from './Breadcrumbs.vue'
import FolderList from './FolderList.vue'
import TrackList from './TrackList.vue'

const library = useLibraryStore()
const player = usePlayerStore()

const {
  currentTracks,
  currentFolder,
  currentSubfolders,
  isLoadingCovers,
  coverProgress,
  tracksWithoutCovers,
  coverStats,
} = storeToRefs(library)

const tracks = computed(() => currentTracks.value)

const hasTracks = computed(() => tracks.value.length > 0)
const hasFolders = computed(() => currentSubfolders.value.length > 0)

const isScanning = computed(() => currentFolder.value?.scanStatus === 'scanning')

const coversNotSearched = computed(() => coverStats.value.checked === 0)
const coversSearched = computed(() => coverStats.value.checked > 0)

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

async function findCovers() {
  closeRefreshMenu()
  await library.fetchCoversForCurrentFolder()
}

async function resetCovers() {
  closeRefreshMenu()
  await library.resetCoversForCurrentFolder()
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-refresh-menu]')) {
    closeRefreshMenu()
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

function playAll() {
  if (isScanning.value) return
  if (tracks.value.length === 0) return
  player.setQueue(tracks.value, 0)
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Шапка -->
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <div class="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <Breadcrumbs />

        <div class="flex shrink-0 items-center gap-3">
          <span v-if="currentFolder && !isScanning" class="text-xs text-zinc-500">
            <template v-if="hasFolders">{{ currentSubfolders.length }} папок</template>
            <template v-if="hasFolders && hasTracks"> · </template>
            <template v-if="hasTracks">{{ tracks.length }} треков</template>
            <template v-if="!hasFolders && !hasTracks">пусто</template>
          </span>

          <span v-else-if="isScanning" class="text-xs text-zinc-500">
            Сканирование…
          </span>

          <!-- Кнопка «Обновить» с сабменю -->
          <div v-if="!isScanning && (canRefresh || canRefreshFromDevice || hasTracks)" data-refresh-menu
            class="relative">
            <button type="button"
              class="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
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
              class="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg">
              <button v-if="canRefresh" type="button"
                class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                @click="refreshFromCloud">
                Обновить с облака
                <span class="block text-[10px] text-zinc-500">
                  Синхронизировать треки с Яндекс.Диска
                </span>
              </button>

              <button v-if="canRefreshFromDevice" type="button"
                class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                @click="refreshFromDevice">
                Обновить с устройства
                <span class="block text-[10px] text-zinc-500">
                  Найти новые и отсутствующие файлы
                </span>
              </button>

              <template v-if="hasTracks">
                <div class="border-t border-zinc-800" />

                <div v-if="isLoadingCovers" class="px-4 py-2.5 text-xs text-zinc-500">
                  Поиск обложек… {{ coverProgress.done }}/{{ coverProgress.total }}
                </div>

                <button v-else-if="coversNotSearched && tracksWithoutCovers > 0" type="button"
                  class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
                  @click="findCovers">
                  Найти обложки ({{ tracksWithoutCovers }})
                  <span class="block text-[10px] text-zinc-500">
                    Через iTunes и Deezer
                  </span>
                </button>

                <template v-else-if="coversSearched">
                  <div class="border-t border-zinc-800" />

                  <div class="flex items-center justify-between px-4 py-2.5 text-xs text-zinc-500">
                    <span>
                      Найдено: {{ coverStats.found }} / {{ coverStats.total }}
                    </span>
                    <button type="button" class="text-zinc-400 transition hover:text-zinc-200" @click="resetCovers">
                      Сбросить
                    </button>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <button v-if="hasTracks && !isScanning" type="button"
            class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
            @click="playAll">
            Играть всё
          </button>
        </div>
      </div>
    </div>

    <!-- Сканирование -->
    <div v-if="isScanning" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          class="h-8 w-8 animate-spin text-emerald-500">
          <path d="M12 3a9 9 0 019 9" />
        </svg>
        <p class="text-sm text-zinc-500">Сканирование папки…</p>
      </div>
    </div>

    <!-- Контент -->
    <div v-else class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl">
        <!-- Папки -->
        <div v-if="hasFolders" class="pb-2">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Папки
          </p>
          <FolderList />
        </div>

        <!-- Треки -->
        <div v-if="hasTracks" class="pb-4">
          <p class="px-5 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            Треки
          </p>
          <TrackList :key="currentFolder?.id" :tracks="tracks" @select="onSelectTrack" />
        </div>

        <!-- Пусто -->
        <div v-if="!hasFolders && !hasTracks"
          class="flex h-full items-center justify-center py-20 text-sm text-zinc-500">
          В этой папке пусто
        </div>
      </div>
    </div>
  </div>
</template>
