<!-- src/App.vue -->
<script setup lang="ts">
import { watchEffect, watch, onMounted, onUnmounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { useHistoryStore } from '@/stores/history'
import { usePlaylistsStore } from '@/stores/playlists'
import { useDislikesStore } from '@/stores/dislikes'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useMediaSession } from '@/composables/useMediaSession'
import { metadataService } from '@/services/metadata/MetadataService'
import { metadataWorkerService } from '@/services/metadata/MetadataWorkerService'
import { trackMetadataService } from '@/services/metadata/TrackMetadataService'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { syncService } from '@/services/download/SyncService'
import { getPlugins, loadPlugin, pluginCanDownload, isStreamingPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { sortService } from '@/services/sort/SortService'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { getPageTitle } from '@/navigation/title'
import { audioService } from '@/services/audio/AudioService'
import { isLocalTrack } from '@/services/library/selectors'
import { guessMetadataFromFilename } from '@/utils/parseFilename'
import type { LibraryTrack } from '@/types/library'
import PlayerControls from '@/components/player/PlayerControls.vue'
import FullPlayer from '@/components/player/FullPlayer.vue'
import ModalHost from '@/components/ui/ModalHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import SyncIssuesModal from '@/components/library/SyncIssuesModal.vue'
import SpacePermissionModal from '@/components/download/SpacePermissionModal.vue'
import AppDrawer from '@/components/layout/AppDrawer.vue'
import FeedbackModal from '@/components/ui/FeedbackModal.vue'
import IconButton from '@/components/ui/IconButton.vue'

const route = useRoute()
const player = usePlayerStore()
const library = useLibraryStore()
const history = useHistoryStore()
const playlists = usePlaylistsStore()
const dislikes = useDislikesStore()
const uiSettings = useUiSettingsStore()
const { currentTrack, isPlaying, queue } = storeToRefs(player)

const isFullPlayerOpen = ref(false)
const isDrawerOpen = ref(false)
const showSyncIssues = ref(false)
const isFeedbackOpen = ref(false)

// Защита от рекурсии в watch(currentTrack)
const processedTracks = new Set<string>()

function openFullPlayer() { isFullPlayerOpen.value = true }
function closeFullPlayer() { isFullPlayerOpen.value = false }
function openDrawer() { isDrawerOpen.value = true }
function closeDrawer() { isDrawerOpen.value = false }
function openFeedback() { isFeedbackOpen.value = true }
function closeFeedback() { isFeedbackOpen.value = false }

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullPlayerOpen.value) {
    closeFullPlayer()
  }
}

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

watch(() => route.fullPath, () => {
  if (isFullPlayerOpen.value) isFullPlayerOpen.value = false
})

watch(() => syncService.issueCount.value, (count) => {
  if (count > 0) showSyncIssues.value = true
})

const queueBadge = computed(() => (queue.value.length > 0 ? String(queue.value.length) : ''))

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

function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && player.isPlaying) {
    const audio = audioService.element
    if (audio.ended || (audio.duration > 0 && audio.currentTime >= audio.duration - 0.5)) {
      player.handleTrackEnd()
    }
  }
}

const isBootstrapping = ref(true)

onMounted(async () => {
  window.addEventListener('keydown', onGlobalKeydown)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  try {
    await uiSettings.load()
    await sortService.load()
    await metadataService.flush()
    await downloadSpaceService.load()
    await history.restore()
    await dislikes.restore()

    // Если папка скачивания уже выбрана — сканируем все плагины с canDownload
    if (downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value) {
      const plugins = getPlugins().filter((p) => p.canDownload)
      for (const p of plugins) {
        void syncService.scanPlugin(p.id)
      }
    }

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

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

async function runAutoFetch(libTrack: LibraryTrack) {
  if (!uiSettings.autoFetchMetadata) return

  // Если у нас есть ID3-теги, автопоиск не нужен
  if (libTrack.hasId3Tags) return

  // Не трогаем ручные и уже найденные
  const canAutoFetch =
    libTrack.metaSource !== 'auto' &&
    libTrack.metaSource !== 'manual' &&
    libTrack.metaSource !== 'unknown'

  if (!canAutoFetch) return

  try {
    const result = await trackMetadataService.fetch(
      libTrack.artist ?? '',
      libTrack.title,
      uiSettings.metadataThreshold,
    )

    if (result.status === 'found') {
      metadataService.applyRemote(libTrack.id, result.data)
    } else if (result.status === 'not-found') {
      useLibraryStore().updateTrackMetadata(libTrack.id, { metaSource: 'unknown' })
    }
  } catch (err) {
    console.warn('[app] auto-fetch failed', err)
  }
}

watch(currentTrack, async (track) => {
  if (!track) return

  // Если это стриминговый трек — не ищем метаданные и не качаем
  if (isStreamingPlugin(track.pluginId)) return

  // ЗАЩИТА ОТ РЕКУРСИИ: если уже обрабатываем этот трек — выходим
  if (processedTracks.has(track.id)) return

  // Помечаем, что начали обработку
  processedTracks.add(track.id)

  const libTrack = library.getTrack(track.id)
  if (!libTrack) return

  // 1. Парсинг локального файла (только если тегов нет)
  if (libTrack.handle && !libTrack.hasId3Tags && libTrack.metaSource !== 'manual') {
    try {
      const file = await libTrack.handle.getFile()
      const parsed = await metadataWorkerService.parse(file)

      if (parsed) {
        metadataService.applyFromFile(libTrack.id, parsed)
        return
      } else {
        const guessed = guessMetadataFromFilename(libTrack.filename ?? libTrack.title)
        useLibraryStore().updateTrackMetadata(libTrack.id, {
          title: guessed.title || libTrack.title,
          artist: guessed.artist || libTrack.artist,
          metaSource: 'filename',
          hasId3Tags: false,
        })
        usePlayerStore().updateTrackInQueue(libTrack.id)

        const updated = library.getTrack(libTrack.id)
        if (updated) void runAutoFetch(updated)
        return
      }
    } catch (err) {
      console.error('[app] failed to parse local track metadata', err)
    }
  }

  // 2. Автопоиск
  void runAutoFetch(libTrack)

  // 3. Автоскачивание
  const isDownloading = downloadOrchestrator.isDownloading(libTrack.id)
  const isWaitingForDownload = uiSettings.autoDownloadTracks &&
    pluginCanDownload(libTrack.pluginId) &&
    !isLocalTrack(libTrack) &&
    !isDownloading

  if (isWaitingForDownload) {
    if (downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value) {
      void downloadOrchestrator.downloadTrack(libTrack).catch((err) => {
        console.warn('[app] auto-download failed', err)
      })
    }
  }
})
</script>

<template>
  <div class="grid h-screen grid-rows-[auto_1fr_auto] bg-bg text-fg relative">
    <!-- Хедер -->
    <header class="app-safe-top flex items-center gap-2 px-3 py-2 z-10">
      <IconButton icon="menu" variant="ghost" size="md" label="Меню" @click="openDrawer" class="!px-3 !w-auto">
        <span class="hidden md:inline text-sm">Меню</span>
        <span v-if="queueBadge"
          class="ml-0.5 rounded-full bg-active/20 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-active">
          {{ queueBadge }}
        </span>
      </IconButton>

      <span v-if="syncService.isSyncing.value" class="text-xs text-fg-muted">Синхронизация…</span>
      <span v-else-if="library.currentFolder" class="ml-2 truncate text-sm text-fg-muted">
        {{ library.currentFolder.name }}
      </span>
    </header>

    <main class="overflow-hidden z-10 relative">
      <RouterView v-if="!isBootstrapping" />
      <div v-else class="flex h-full items-center justify-center text-sm text-fg-muted">Загрузка…</div>
    </main>

    <div class="z-20 relative">
      <PlayerControls @open="openFullPlayer" />
    </div>

    <ModalHost />
    <ToastHost />
    <SyncIssuesModal v-if="showSyncIssues" @close="showSyncIssues = false" />
    <SpacePermissionModal v-if="downloadSpaceService.needsPermission.value" />
    <FeedbackModal v-if="isFeedbackOpen" @close="closeFeedback" />

    <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-4"
      enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-4">
      <FullPlayer v-if="isFullPlayerOpen" :title="pageTitle" @close="closeFullPlayer" />
    </Transition>

    <AppDrawer :open="isDrawerOpen" @close="closeDrawer" @open-feedback="openFeedback" />
  </div>
</template>
