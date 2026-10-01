<!-- src/App.vue -->
<script setup lang="ts">
import { watchEffect, watch, onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useHistoryStore } from '@/stores/history'
import { usePlaylistsStore } from '@/stores/playlists'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaSession } from '@/composables/useMediaSession'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { syncService } from '@/services/download/SyncService'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import { sortService } from '@/services/sort/SortService'
import PlayerControls from '@/components/player/PlayerControls.vue'
import FullPlayer from '@/components/player/FullPlayer.vue'
import ModalHost from '@/components/ui/ModalHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import SyncIssuesModal from '@/components/library/SyncIssuesModal.vue'
import { usePwaUpdate } from "./composables/usePwaUpdate"
import { useDislikesStore } from "./stores/dislikes"
import IconEyeOff from "./components/icons/IconEyeOff.vue"
import { NO_ALBUM_SLUG } from "./utils/artists.ts"
import { metadataPersistenceService } from "./services/persistence/MetadataPersistenceService.ts"
import { useUiSettingsStore } from "./stores/uiSettings.ts"

const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const library = useLibraryStore()
const history = useHistoryStore()
const playlists = usePlaylistsStore()
const dislikes = useDislikesStore()
const uiSettings = useUiSettingsStore()
const { currentTrack, isPlaying, queue } = storeToRefs(player)

// --- FullPlayer ------------------------------------------------------

const isFullPlayerOpen = ref(false)

function openFullPlayer() {
  isFullPlayerOpen.value = true
}

function closeFullPlayer() {
  isFullPlayerOpen.value = false
}

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullPlayerOpen.value) {
    closeFullPlayer()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

// --- Заголовок FullPlayer --------------------------------------------

const pageTitle = computed(() => {
  const name = route.name
  if (name === 'home') return 'Главная'
  if (name === 'search') return 'Поиск'
  if (name === 'folder') return library.currentFolder?.name ?? 'Папка'
  if (name === 'playlists') return 'Плейлисты'
  if (name === 'playlist') {
    const id = String(route.params.id ?? '')
    return playlists.getPlaylist(id)?.name ?? 'Плейлист'
  }
  if (name === 'history') return 'История'
  if (name === 'queue') return 'Очередь'
  if (name === 'dislikes') return 'Дизлайки'
  if (name === 'artist') return String(route.params.artistName ?? 'Артист')
  if (name === 'album') {
    const album = String(route.params.album ?? '')
    const artistName = String(route.params.artistName ?? '')
    if (album === NO_ALBUM_SLUG) return `${artistName} — Без альбома`
    return `${artistName} — ${album}`
  }
  return 'Плеер'
})

// Закрываем FullPlayer при любом переходе
watch(
  () => route.fullPath,
  () => {
    if (isFullPlayerOpen.value) {
      isFullPlayerOpen.value = false
    }
  },
)

// --- Свайп вверх из мини-плеера -------------------------------------

const SWIPE_UP_THRESHOLD = 100 // px

let swipeStartY = 0
let swipeTracking = false

function onFooterPointerDown(e: PointerEvent) {
  if (e.pointerType !== 'touch') return

  const target = e.target as HTMLElement
  const isOpenTrigger = target.closest('[data-player-open]') !== null
  if (!isOpenTrigger && target.closest('button, input, a, [role="button"]')) return

  swipeStartY = e.clientY
  swipeTracking = true
}

function onFooterPointerMove(e: PointerEvent) {
  if (!swipeTracking) return
  const dy = swipeStartY - e.clientY
  if (dy >= SWIPE_UP_THRESHOLD) {
    swipeTracking = false
    openFullPlayer()
  }
}

function onFooterPointerUp() {
  swipeTracking = false
}

// --- Шторка ----------------------------------------------------------

const isDrawerOpen = ref(false)
const showSyncIssues = ref(false)

const queueBadge = computed(() => (queue.value.length > 0 ? String(queue.value.length) : ''))

function openDrawer() {
  isDrawerOpen.value = true
}

function closeDrawer() {
  isDrawerOpen.value = false
}

function goHome() {
  closeDrawer()
  router.push({ name: 'home' })
}

function goToPlaylists() {
  closeDrawer()
  router.push({ name: 'playlists' })
}

function goToHistory() {
  closeDrawer()
  router.push({ name: 'history' })
}

function goToQueue() {
  closeDrawer()
  router.push({ name: 'queue' })
}

function goToDislikes() {
  closeDrawer()
  router.push({ name: 'dislikes' })
}

function goToSearch() {
  closeDrawer()
  router.push({ name: 'search' })
}

async function restoreSpaceAccess() {
  const state = await downloadSpaceService.requestAccess()

  if (state === 'granted') {
    toastService.success('Доступ к папке скачивания восстановлен')
    return
  }

  toastService.error('Доступ отклонён. Выберите папку заново')
  const handle = await downloadSpaceService.pickSpace()
  if (handle) {
    toastService.success('Папка скачивания выбрана')
  } else {
    toastService.info('Папка не выбрана. Скачивание недоступно')
  }
}

// --- Горячие клавиши, медиа-сессия, заголовок -------------------------

useKeyboardShortcuts({
  onToggle: () => player.toggle(),
  onToggleMute: () => player.toggleMute(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeekBy: (delta) => player.seekBy(delta),
  onVolumeBy: (delta) => player.setVolumeBy(delta),
})

useMediaSession({
  currentTrack,
  isPlaying,
  onPlay: () => player.play(),
  onPause: () => player.pause(),
  onNext: () => player.next(),
  onPrev: () => player.prev(),
  onSeek: (t) => player.seek(t),
  onSeekBy: (d) => player.seekBy(d),
})

watchEffect(() => {
  const t = currentTrack.value
  document.title = t ? `${t.title} — ${t.artist}` : 'CUEI Media Player'
})

// --- Восстановление при старте ----------------------------------------

const isBootstrapping = ref(true)

onMounted(async () => {
  try {
    await sortService.load()
    await metadataPersistenceService.load()
    await downloadSpaceService.load()
    await history.restore()
    await dislikes.restore()
    await uiSettings.load()

    for (const manifest of getPlugins()) {
      try {
        const plugin = await loadPlugin(manifest.id)
        const context = createPluginContext(manifest.id)
        const restored = await plugin.restoreFromCache(context)
        if (restored) console.info(`[app] restored source: ${manifest.id}`)
      } catch (err) {
        console.warn(`[app] failed to restore source "${manifest.id}"`, err)
      }
    }

    const playerRestored = await player.restore()
    if (playerRestored) console.log('[player] restored')
  } finally {
    isBootstrapping.value = false
  }
})

usePwaUpdate()
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-bg text-fg">
    <!-- Хедер -->
    <header class="app-safe-top flex items-center gap-2 px-3 py-2">
      <button type="button"
        class="flex items-center gap-1.5 rounded-btn px-3 py-2 text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
        aria-label="Меню" @click="openDrawer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span class="hidden md:inline">Меню</span>
        <span v-if="queueBadge"
          class="ml-0.5 rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active">
          {{ queueBadge }}
        </span>
      </button>

      <span v-if="syncService.isSyncing.value" class="text-xs text-fg-muted">Синхронизация…</span>

      <span v-else-if="library.currentFolder" class="ml-2 truncate text-sm text-fg-muted">
        {{ library.currentFolder.name }}
      </span>
    </header>

    <main class="overflow-hidden">
      <RouterView v-if="!isBootstrapping" />
      <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка…</div>
    </main>

    <!-- Мини-плеер + свайп вверх -->
    <div ref="playerFooterRef" @pointerdown="onFooterPointerDown" @pointermove="onFooterPointerMove"
      @pointerup="onFooterPointerUp" @pointercancel="onFooterPointerUp">
      <PlayerControls @open="openFullPlayer" />
    </div>

    <ModalHost />
    <ToastHost />
    <SyncIssuesModal v-if="showSyncIssues" @close="showSyncIssues = false" />

    <!-- FullPlayer -->
    <FullPlayer v-if="isFullPlayerOpen" :title="pageTitle" @close="closeFullPlayer" />

    <!-- Шторка меню -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200" enter-from-class="opacity-0" enter-to-class="opacity-100"
        leave-active-class="transition duration-150" leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="isDrawerOpen" class="fixed inset-0 z-[120] bg-bg/90" @click="closeDrawer" />
      </Transition>

      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="-translate-x-full"
        enter-to-class="translate-x-0" leave-active-class="transition duration-150 ease-in"
        leave-from-class="translate-x-0" leave-to-class="-translate-x-full">
        <div v-if="isDrawerOpen"
          class="fixed inset-y-0 left-0 z-[130] flex w-[80vw] max-w-sm flex-col bg-bg shadow-[0_0_10px_rgba(0,0,0,0.25)]">
          <div class="app-safe-top flex items-center gap-2 px-4 py-4">
            <button type="button" class="rounded-btn p-2 text-fg transition hover:bg-hover-bg" aria-label="Закрыть меню"
              @click="closeDrawer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-6 w-6">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav class="flex flex-1 flex-col gap-1 px-4 py-2">
            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="goHome">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-6 w-6 text-fg-muted">
                <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
              </svg>
              Главная
            </button>

            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="goToSearch">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-6 w-6 text-fg-muted">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              Поиск
            </button>

            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="goToPlaylists">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-6 w-6 text-fg-muted">
                <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Плейлисты
            </button>

            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="goToDislikes">
              <IconEyeOff class="h-6 w-6 text-fg-muted" />
              Дизлайки
            </button>

            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-md font-medium text-fg transition hover:bg-hover-bg"
              @click="goToHistory">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-6 w-6 text-fg-muted">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              История
            </button>

            <button type="button"
              class="flex items-center gap-4 rounded-btn px-3 py-3 text-left text-lg font-medium text-fg transition hover:bg-hover-bg"
              @click="goToQueue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                class="h-6 w-6 text-fg-muted">
                <path d="M4 6h16M4 12h10M4 18h6" />
              </svg>
              <span class="flex-1">Очередь</span>
              <span v-if="queueBadge"
                class="rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active">
                {{ queueBadge }}
              </span>
            </button>
          </nav>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
