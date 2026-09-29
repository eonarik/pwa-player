<!-- src/components/library/FolderList.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import type { Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)

/** Активный обход прямо сейчас — блокирует весь UI */
function isScanning(folder: Folder): boolean {
  return folder.scanStatus === 'scanning'
}

/** Поддерево не готово — счётчик «…», play недоступен */
function isNotReady(folder: Folder): boolean {
  return folder.ready !== true
}

/** Нужно принудительное сканирование при заходе */
function needsScan(folder: Folder): boolean {
  return folder.scanStatus === undefined
}

function formatCount(folder: Folder): string {
  if (isNotReady(folder)) return '…'
  const n = folder.totalTrackCount
  if (n === 0) return 'пусто'
  if (n === 1) return '1 трек'
  if (n >= 2 && n <= 4) return `${n} трека`
  return `${n} треков`
}

/** Заход в папку: разрешён, если не идёт активный обход */
async function openFolder(folder: Folder) {
  if (isScanning(folder)) return

  if (needsScan(folder) && folder.source) {
    try {
      const plugin = await loadPlugin(folder.source)
      if (plugin.scanFolder) {
        const context = createPluginContext(folder.source)
        await plugin.scanFolder(context, folder.id, { recursive: false })
      }
    } catch (err) {
      console.error('[folder-list] scan failed', err)
      return
    }
  }

  const segments = folder.path.split('/').filter(Boolean)
  router.push({
    name: 'folder',
    params: { pluginId: folder.source ?? '', path: segments },
  })
}

/** Играть папку: разрешено, если ready: true. Иначе — тост. */
async function playFolder(folder: Folder) {
  if (isScanning(folder)) {
    toastService.info('Папка сканируется, подождите')
    return
  }
  if (isNotReady(folder)) {
    toastService.info('Поддерево ещё не готово')
    return
  }

  const tracks = library.getAllTracksInFolderRecursive(folder.id)
  if (tracks.length === 0) return
  player.setQueue(tracks, 0)
}

function isTrackInFolderTree(track: Track, folderId: string): boolean {
  const trackFolderId = (track as LibraryTrack).folderId
  if (!trackFolderId) return false

  let current = library.getFolder(trackFolderId)
  while (current) {
    if (current.id === folderId) return true
    current = current.parentId ? library.getFolder(current.parentId) : null
  }
  return false
}

function isPlayingFromFolder(folder: Folder): boolean {
  const track = currentTrack.value
  if (!track) return false
  return isTrackInFolderTree(track, folder.id)
}

function isFolderActive(folder: Folder): boolean {
  return isPlayingFromFolder(folder) && isPlaying.value
}

function toggleFolderPlayback(folder: Folder) {
  if (isPlayingFromFolder(folder)) {
    player.toggle()
    return
  }
  void playFolder(folder)
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5 px-2 py-2">
    <div v-for="folder in currentSubfolders" :key="folder.id"
      class="flex items-center gap-3 rounded-lg px-3 py-2 transition" :class="[
        isScanning(folder)
          ? 'opacity-60'
          : isFolderActive(folder)
            ? 'bg-emerald-500/10 text-emerald-400'
            : isPlayingFromFolder(folder)
              ? 'bg-emerald-500/5 text-emerald-400/80'
              : 'text-zinc-300 hover:bg-zinc-800/60',
      ]">
      <!-- Иконка: папка / play / pause / спиннер -->
      <button type="button"
        class="group/icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition" :class="[
          isScanning(folder)
            ? 'bg-zinc-800 cursor-default'
            : isPlayingFromFolder(folder)
              ? 'bg-emerald-500/20'
              : 'bg-zinc-800 hover:bg-emerald-500/20',
        ]" :disabled="isScanning(folder)" :aria-label="isScanning(folder)
          ? `Сканирование ${folder.name}`
          : isFolderActive(folder)
            ? `Пауза`
            : isPlayingFromFolder(folder)
              ? `Продолжить`
              : isNotReady(folder)
                ? `Папка не готова`
                : `Играть папку ${folder.name}`
          " @click.stop="toggleFolderPlayback(folder)">
        <template v-if="isScanning(folder)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            class="h-5 w-5 animate-spin text-zinc-500">
            <path d="M12 3a9 9 0 019 9" />
          </svg>
        </template>

        <template v-else-if="!isPlayingFromFolder(folder)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
            class="h-5 w-5 text-zinc-500 transition group-hover/icon:opacity-0">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <svg viewBox="0 0 24 24" fill="currentColor"
            class="absolute h-5 w-5 text-emerald-400 opacity-0 transition group-hover/icon:opacity-100">
            <path d="M8 5v14l11-7z" />
          </svg>
        </template>

        <svg v-else-if="isFolderActive(folder)" viewBox="0 0 24 24" fill="currentColor"
          class="h-5 w-5 text-emerald-400">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>

        <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5 text-emerald-400">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- Имя и счётчик: клик работает всегда, кроме активного обхода -->
      <button type="button" class="min-w-0 flex-1 text-left" :disabled="isScanning(folder)" @click="openFolder(folder)">
        <p class="truncate text-sm font-medium">{{ folder.name }}</p>
        <p class="truncate text-xs" :class="isPlayingFromFolder(folder) && !isScanning(folder)
          ? 'text-emerald-400/60'
          : 'text-zinc-500'
          ">
          <template v-if="isScanning(folder)"> Сканирование… </template>
          <template v-else-if="isNotReady(folder)"> Сканирование… </template>
          <template v-else> {{ formatCount(folder) }} </template>
        </p>
      </button>

      <!-- Стрелка: клик работает всегда, кроме активного обхода -->
      <button type="button" class="shrink-0 rounded-md p-1 transition" :class="[
        isScanning(folder)
          ? 'text-zinc-700 cursor-default'
          : isPlayingFromFolder(folder)
            ? 'text-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-400'
            : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400',
      ]" :disabled="isScanning(folder)" :aria-label="`Открыть папку ${folder.name}`" @click="openFolder(folder)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>
