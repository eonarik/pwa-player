<!-- src/components/library/FolderView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import Breadcrumbs from './Breadcrumbs.vue'
import FolderList from './FolderList.vue'
import TrackList from './TrackList.vue'
import FolderDownloadButton from "./FolderDownloadButton.vue"
import { syncService } from "@/services/download/SyncService.ts"
import { toastService } from "@/services/ui/ToastService.ts"

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

const coversNotSearched = computed(() => coverStats.value.checked === 0)
const coversSearched = computed(() => coverStats.value.checked > 0)

/** Умеет ли текущий источник обновляться */
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
      canRefresh.value = typeof plugin.refreshFolder === 'function'
      canRefreshFromDevice.value =
        plugin.canDownload === true && typeof plugin.scanDownloadDir === 'function'
    } catch {
      canRefresh.value = false
      canRefreshFromDevice.value = false
    }
  },
  { immediate: true },
)

const canDownload = ref(false)
watch(
  () => currentFolder.value?.source,
  async (sourceId) => {
    if (!sourceId) {
      canDownload.value = false
      return
    }
    try {
      const plugin = await loadPlugin(sourceId)
      canDownload.value = plugin.canDownload
    } catch {
      canDownload.value = false
    }
  },
  { immediate: true },
)

const isRefreshing = ref(false)

async function refreshFolder() {
  const folder = currentFolder.value
  if (!folder || !folder.source) return

  try {
    const plugin = await loadPlugin(folder.source)
    if (!plugin.refreshFolder) return

    isRefreshing.value = true
    const context = createPluginContext(folder.source)
    await plugin.refreshFolder(context, folder.id)
  } catch (err) {
    console.error('[folder-view] refresh failed', err)
  } finally {
    isRefreshing.value = false
  }
}

function onSelectTrack(index: number) {
  player.setQueue(tracks.value, index)
}

function playAll() {
  if (tracks.value.length === 0) return
  player.setQueue(tracks.value, 0)
}

async function fetchCovers() {
  await library.fetchCoversForCurrentFolder()
}

async function resetCovers() {
  await library.resetCoversForCurrentFolder()
}


const isRefreshMenuOpen = ref(false)
const isRefreshingFromDevice = ref(false)

function toggleRefreshMenu() {
  isRefreshMenuOpen.value = !isRefreshMenuOpen.value
}

function closeRefreshMenu() {
  isRefreshMenuOpen.value = false
}

async function refreshFromCloud() {
  closeRefreshMenu()
  await refreshFolder()
}

async function refreshFromDevice() {
  closeRefreshMenu()

  const folder = currentFolder.value
  if (!folder || !folder.source) return

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
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <Breadcrumbs />

      <div class="flex shrink-0 items-center gap-3">
        <span v-if="currentFolder" class="text-xs text-zinc-500">
          <template v-if="hasFolders">{{ currentSubfolders.length }} папок</template>
          <template v-if="hasFolders && hasTracks"> · </template>
          <template v-if="hasTracks">{{ tracks.length }} треков</template>
          <template v-if="!hasFolders && !hasTracks">пусто</template>
        </span>

        <!-- Кнопка «Обновить» с сабменю -->
        <div v-if="canRefresh || canRefreshFromDevice" data-refresh-menu class="relative">
          <button type="button"
            class="flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
            :disabled="isRefreshing || isRefreshingFromDevice" @click.stop="toggleRefreshMenu">
            <span v-if="isRefreshing">Обновление…</span>
            <span v-else-if="isRefreshingFromDevice">Сканирование…</span>
            <span v-else>Обновить</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3 w-3 transition"
              :class="isRefreshMenuOpen ? 'rotate-180' : ''">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div v-if="isRefreshMenuOpen"
            class="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-lg">
            <button v-if="canRefresh" type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              @click="refreshFromCloud">
              С облака
              <span class="block text-[10px] text-zinc-500">Обновить треки с Яндекс.Диска</span>
            </button>

            <button v-if="canRefreshFromDevice" type="button"
              class="block w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              @click="refreshFromDevice">
              С устройства
              <span class="block text-[10px] text-zinc-500">Найти новые и отсутствующие файлы</span>
            </button>
          </div>
        </div>

        <template v-if="hasTracks">
          <div v-if="isLoadingCovers" class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500">
            Поиск… {{ coverProgress.done }}/{{ coverProgress.total }}
          </div>

          <button v-else-if="coversNotSearched && tracksWithoutCovers > 0" type="button"
            class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
            @click="fetchCovers">
            Найти обложки ({{ tracksWithoutCovers }})
          </button>

          <template v-else-if="coversSearched">
            <div class="flex items-center gap-2 text-xs text-zinc-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                class="h-3.5 w-3.5 text-emerald-500">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>
                Найдено:
                <span class="text-zinc-300">{{ coverStats.found }}</span>
                / {{ coverStats.total }}
              </span>
            </div>

            <button type="button"
              class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
              @click="resetCovers">
              Сбросить
            </button>
          </template>
        </template>

        <FolderDownloadButton v-if="canDownload && currentFolder" :folder-id="currentFolder.id" />

        <button v-if="hasTracks" type="button"
          class="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25"
          @click="playAll">
          Играть всё
        </button>
      </div>
    </div>

    <div v-if="hasFolders" class="shrink-0 overflow-y-auto border-b border-zinc-800"
      :class="hasTracks ? 'max-h-[40%]' : 'flex-1'">
      <FolderList />
    </div>

    <div v-if="hasTracks" class="min-h-0 flex-1">
      <TrackList :key="currentFolder?.id" :tracks="tracks" @select="onSelectTrack" />
    </div>

    <div v-else-if="!hasFolders" class="flex flex-1 items-center justify-center text-sm text-zinc-500">
      В этой папке пусто
    </div>
  </div>
</template>
