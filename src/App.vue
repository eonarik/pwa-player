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
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { syncService } from '@/services/download/SyncService'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import { sortService } from '@/services/sort/SortService'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getPageTitle } from '@/navigation/title'
import PlayerControls from '@/components/player/PlayerControls.vue'
import FullPlayer from '@/components/player/FullPlayer.vue'
import ModalHost from '@/components/ui/ModalHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import SyncIssuesModal from '@/components/library/SyncIssuesModal.vue'
import SpacePermissionModal from '@/components/download/SpacePermissionModal.vue'
import AppDrawer from '@/components/layout/AppDrawer.vue'
import IconMenu from '@/components/icons/IconMenu.vue'

const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const library = useLibraryStore()
const history = useHistoryStore()
const playlists = usePlaylistsStore()
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

const pageTitle = computed(() =>
  getPageTitle(route, {
    folderName: library.currentFolder?.name ?? null,
    playlistName: (() => {
      if (route.name !== 'playlist') return null
      const id = String(route.params.id ?? '')
      return playlists.getPlaylist(id)?.name ?? null
    })(),
  }),
)

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

const SWIPE_UP_THRESHOLD = 100

const playerFooterRef = ref<HTMLElement | null>(null)
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
    await uiSettings.load()
    await sortService.load()
    await metadataPersistenceService.load()
    await downloadSpaceService.load()
    await history.restore()

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
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-bg text-fg">
    <!-- Хедер -->
    <header class="app-safe-top flex items-center gap-2 px-3 py-2">
      <button type="button"
        class="flex items-center gap-1.5 rounded-btn px-3 py-2 text-sm text-fg-muted transition hover:bg-hover-bg hover:text-fg"
        aria-label="Меню" @click="openDrawer">
        <IconMenu class="h-4 w-4" />
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
    <SpacePermissionModal v-if="downloadSpaceService.needsPermission.value" />

    <!-- FullPlayer -->
    <FullPlayer v-if="isFullPlayerOpen" :title="pageTitle" @close="closeFullPlayer" />

    <!-- Шторка -->
    <AppDrawer :open="isDrawerOpen" @close="closeDrawer" />
  </div>
</template>
