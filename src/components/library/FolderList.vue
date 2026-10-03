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
import IconFolder from '@/components/icons/IconFolder.vue'
import IconPlay from '@/components/icons/IconPlay.vue'
import IconPause from '@/components/icons/IconPause.vue'
import IconSpinner from '@/components/icons/IconSpinner.vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
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

function folderStatus(folder: Folder): 'scanning' | 'pending' | 'ready' {
  if (folder.scanStatus === 'scanning') return 'scanning'
  if (folder.ready === true) return 'ready'
  return 'pending'
}

function hasNoTracks(folder: Folder): boolean {
  return folder.ready === true && folder.totalTrackCount === 0
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
  if (hasNoTracks(folder)) return
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
  if (hasNoTracks(folder)) return
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
              isScanning(folder)
                ? 'bg-card-bg text-fg-muted cursor-default'
                : isEmpty(folder) || hasNoTracks(folder)
                  ? 'bg-card-bg text-fg-disabled cursor-default'
                  : folderPlayState(folder) === 'playing'
                    ? 'bg-active/20 text-active hover:bg-active/30'
                    : folderPlayState(folder) === 'paused'
                      ? 'bg-active/15 text-active hover:bg-active/25'
                      : 'bg-card-bg text-fg-muted hover:bg-active/15 hover:text-active',
            ]" :disabled="isScanning(folder) || isEmpty(folder) || hasNoTracks(folder)" :aria-label="isScanning(folder)
              ? `Сканирование ${folder.name}`
              : folderPlayState(folder) === 'playing'
                ? 'Пауза'
                : folderPlayState(folder) === 'paused'
                  ? 'Продолжить'
                  : `Играть папку ${folder.name}`
              " @click="toggleFolderPlayback(folder, $event)">
            <IconSpinner v-if="isScanning(folder)" class="h-5 w-5 animate-spin" />
            <IconPause v-else-if="folderPlayState(folder) === 'playing'" class="h-5 w-5" />
            <IconPlay v-else class="h-5 w-5 translate-x-[1px]" />
          </button>

          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition" :class="isScanning(folder)
            ? 'bg-card-bg text-fg-muted'
            : folderPlayState(folder) !== 'idle'
              ? 'bg-active/15 text-active'
              : 'bg-card-bg text-fg-muted'
            ">
            <IconFolder class="h-5 w-5" />
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
          <template v-if="folderStatus(folder) === 'scanning'">Сканирование…</template>
          <template v-else-if="folderStatus(folder) === 'pending'">Ожидает сканирования</template>
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
          <IconChevronRight class="h-4 w-4" />
        </button>
      </template>
    </ListRow>
  </div>
</template>
