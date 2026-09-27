<!-- src/components/library/FolderList.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import type { Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)

function formatCount(n: number): string {
  if (n === 0) return 'пусто'
  if (n === 1) return '1 трек'
  if (n >= 2 && n <= 4) return `${n} трека`
  return `${n} треков`
}

function openFolder(folder: Folder) {
  const segments = folder.path.split('/').filter(Boolean)
  router.push({ name: 'folder', params: { path: segments } })
}

function playFolder(folder: Folder) {
  const tracks = library.getAllTracksInFolderRecursive(folder.id)
  if (tracks.length === 0) return
  player.setQueue(tracks, 0)
}

/**
 * Проверяет, лежит ли трек в поддереве папки (папка сама или любая вложенная).
 */
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

/** Текущий трек играет из этой папки или её подпапок */
function isPlayingFromFolder(folder: Folder): boolean {
  const track = currentTrack.value
  if (!track) return false
  return isTrackInFolderTree(track, folder.id)
}

/** Текущий трек играет прямо сейчас (не пауза) */
function isFolderActive(folder: Folder): boolean {
  return isPlayingFromFolder(folder) && isPlaying.value
}

/** Клик по иконке: play/pause если из этой папки, иначе — играть эту папку */
function toggleFolderPlayback(folder: Folder) {
  if (isPlayingFromFolder(folder)) {
    player.toggle()
    return
  }
  playFolder(folder)
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5 px-2 py-2">
    <div v-for="folder in currentSubfolders" :key="folder.id"
      class="flex items-center gap-3 rounded-lg px-3 py-2 transition" :class="isFolderActive(folder)
          ? 'bg-emerald-500/10 text-emerald-400'
          : isPlayingFromFolder(folder)
            ? 'bg-emerald-500/5 text-emerald-400/80'
            : 'text-zinc-300 hover:bg-zinc-800/60'
        ">
      <!-- Иконка: папка / play / pause -->
      <button type="button"
        class="group/icon relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition" :class="isPlayingFromFolder(folder)
            ? 'bg-emerald-500/20'
            : 'bg-zinc-800 hover:bg-emerald-500/20'
          " :aria-label="isFolderActive(folder)
            ? `Пауза`
            : isPlayingFromFolder(folder)
              ? `Продолжить`
              : `Играть папку ${folder.name}`
          " @click.stop="toggleFolderPlayback(folder)">
        <!-- Иконка папки: показывается, если трек не из этой папки -->
        <svg v-if="!isPlayingFromFolder(folder)" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.75" class="h-5 w-5 text-zinc-500 transition group-hover/icon:opacity-0">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>

        <!-- Иконка play: при hover на папку без воспроизведения -->
        <svg v-if="!isPlayingFromFolder(folder)" viewBox="0 0 24 24" fill="currentColor"
          class="absolute h-5 w-5 text-emerald-400 opacity-0 transition group-hover/icon:opacity-100">
          <path d="M8 5v14l11-7z" />
        </svg>

        <!-- Иконка пауза: если трек из этой папки и играет -->
        <svg v-if="isFolderActive(folder)" viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5 text-emerald-400">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>

        <!-- Иконка play: если трек из этой папки, но на паузе -->
        <svg v-if="isPlayingFromFolder(folder) && !isFolderActive(folder)" viewBox="0 0 24 24" fill="currentColor"
          class="h-5 w-5 text-emerald-400">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>

      <!-- Имя и счётчик -->
      <button type="button" class="min-w-0 flex-1 text-left" @click="openFolder(folder)">
        <p class="truncate text-sm font-medium">{{ folder.name }}</p>
        <p class="truncate text-xs" :class="isPlayingFromFolder(folder) ? 'text-emerald-400/60' : 'text-zinc-500'">
          {{ formatCount(folder.totalTrackCount) }}
        </p>
      </button>

      <!-- Стрелка -->
      <button type="button" class="shrink-0 rounded-md p-1 transition" :class="isPlayingFromFolder(folder)
          ? 'text-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-400'
          : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
        " :aria-label="`Открыть папку ${folder.name}`" @click="openFolder(folder)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  </div>
</template>
