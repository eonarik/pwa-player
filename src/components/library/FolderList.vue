<!-- src/components/library/FolderList.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { toastService } from '@/services/ui/ToastService'
import { pluralize } from '@/utils/pluralize'
import ListRow from '@/components/ui/ListRow.vue'
import type { Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)

type FolderPlayState = 'idle' | 'playing' | 'paused'

function formatCount(folder: Folder): string {
  if (folder.ready !== true) return '…'

  const tracks = folder.totalTrackCount
  const files = folder.totalTextFileCount ?? 0

  const tracksPart = pluralize(tracks, ['трек', 'трека', 'треков'])
  if (files === 0) return tracksPart

  const filesPart = pluralize(files, ['файл', 'файла', 'файлов'])
  return `${tracksPart} · ${filesPart}`
}

function isScanning(folder: Folder): boolean {
  return folder.scanStatus === 'scanning'
}

function isEmpty(folder: Folder): boolean {
  return (
    folder.ready === true &&
    folder.totalTrackCount === 0 &&
    (folder.totalTextFileCount ?? 0) === 0
  )
}

function needsScan(folder: Folder): boolean {
  return folder.scanStatus === undefined
}

async function openFolder(folder: Folder) {
  if (isScanning(folder)) return
  if (isEmpty(folder)) return

  if (needsScan(folder) && folder.source) {
    try {
      const plugin = await loadPlugin(pluginIdFromSource(folder.source))
      if (plugin.scanFolder) {
        const context = createPluginContext(pluginIdFromSource(folder.source))
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

async function playFolder(folder: Folder) {
  if (isScanning(folder)) {
    toastService.info('Папка сканируется, подождите')
    return
  }
  if (isEmpty(folder)) return
  if (folder.ready !== true) {
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

function folderPlayState(folder: Folder): FolderPlayState {
  if (!isPlayingFromFolder(folder)) return 'idle'
  return isPlaying.value ? 'playing' : 'paused'
}

function onRowClick(folder: Folder) {
  if (isEmpty(folder)) return
  void openFolder(folder)
}

function toggleFolderPlayback(folder: Folder, e: Event) {
  e.stopPropagation()
  if (isEmpty(folder)) return
  if (isScanning(folder)) {
    toastService.info('Папка сканируется, подождите')
    return
  }
  if (isPlayingFromFolder(folder)) {
    player.toggle()
    return
  }
  void playFolder(folder)
}

function onArrowClick(folder: Folder, e: Event) {
  e.stopPropagation()
  if (isEmpty(folder)) return
  void openFolder(folder)
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5">
    <ListRow v-for="folder in currentSubfolders" :key="folder.id"
      :active="folderPlayState(folder) !== 'idle' && !isEmpty(folder)" :class="isEmpty(folder) ? 'opacity-40' : ''"
      @click="onRowClick(folder)">
      <!-- Leading: play/pause + иконка папки -->
      <template #leading>
        <div class="flex shrink-0 items-center gap-2">
          <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition"
            :class="[
              isScanning(folder) || isEmpty(folder)
                ? 'bg-card-bg text-fg-muted cursor-default'
                : folderPlayState(folder) === 'playing'
                  ? 'bg-active/20 text-active hover:bg-active/30'
                  : folderPlayState(folder) === 'paused'
                    ? 'bg-active/15 text-active hover:bg-active/25'
                    : 'bg-card-bg text-fg-muted hover:bg-active/15 hover:text-active',
            ]" :disabled="isScanning(folder) || isEmpty(folder)" :aria-label="isScanning(folder)
                ? `Сканирование ${folder.name}`
                : folderPlayState(folder) === 'playing'
                  ? 'Пауза'
                  : folderPlayState(folder) === 'paused'
                    ? 'Продолжить'
                    : `Играть папку ${folder.name}`
              " @click="toggleFolderPlayback(folder, $event)">
            <template v-if="isScanning(folder)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-5 w-5 animate-spin">
                <path d="M12 3a9 9 0 019 9" />
              </svg>
            </template>

            <svg v-else-if="folderPlayState(folder) === 'playing'" viewBox="0 0 24 24" fill="currentColor"
              class="h-5 w-5">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>

            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5 translate-x-[1px]">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition" :class="isScanning(folder)
              ? 'bg-card-bg text-fg-muted'
              : folderPlayState(folder) !== 'idle'
                ? 'bg-active/15 text-active'
                : 'bg-card-bg text-fg-muted'
            ">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="h-5 w-5">
              <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
        </div>
      </template>

      <!-- Title -->
      <template #title>
        <p class="truncate text-sm font-medium">{{ folder.name }}</p>
      </template>

      <!-- Subtitle -->
      <template #subtitle>
        <p class="truncate text-xs" :class="folderPlayState(folder) !== 'idle' && !isScanning(folder)
            ? 'text-active/60'
            : 'text-fg-muted'
          ">
          <template v-if="isScanning(folder)">Сканирование…</template>
          <template v-else>{{ formatCount(folder) }}</template>
        </p>
      </template>

      <!-- Trailing: стрелка -->
      <template #trailing>
        <button type="button" class="shrink-0 rounded-md p-1 transition" :class="[
          isScanning(folder) || isEmpty(folder)
            ? 'text-fg-disabled cursor-default'
            : folderPlayState(folder) !== 'idle'
              ? 'text-active/60 hover:bg-active/20 hover:text-active'
              : 'text-fg-subtle hover:bg-hover-bg hover:text-fg-muted',
        ]" :disabled="isScanning(folder) || isEmpty(folder)" :aria-label="`Открыть папку ${folder.name}`"
          @click="onArrowClick(folder, $event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-4 w-4">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </template>
    </ListRow>
  </div>
</template>
