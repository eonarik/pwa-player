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
import Icon from '@/components/ui/Icon.vue'
import type { Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const { currentSubfolders } = storeToRefs(library)
const { currentTrack, isPlaying } = storeToRefs(player)

type FolderPlayState = 'idle' | 'playing' | 'paused'

function formatCount(folder: Folder): string {
  if (!library.isSubtreeScanned(folder.id)) return '…'

  const subfolders = folder.childFolderIds.length
  const tracks = folder.totalTrackCount
  const files = folder.totalTextFileCount ?? 0

  const parts: string[] = []

  if (subfolders > 0) {
    parts.push(pluralize(subfolders, ['папка', 'папки', 'папок']))
  }

  if (tracks > 0) {
    parts.push(pluralize(tracks, ['трек', 'трека', 'треков']))
  }

  if (files > 0) {
    parts.push(pluralize(files, ['файл', 'файла', 'файлов']))
  }

  return parts.length > 0 ? parts.join(' · ') : 'пусто'
}

function isScanning(folder: Folder): boolean {
  return folder.scanState === 'scanning'
}

function isEmpty(folder: Folder): boolean {
  return (
    library.isSubtreeScanned(folder.id) &&
    folder.totalTrackCount === 0 &&
    (folder.totalTextFileCount ?? 0) === 0
  )
}

function needsScan(folder: Folder): boolean {
  return (folder.scanState ?? 'pending') === 'pending'
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
  if (folder.totalTrackCount === 0) return
  if (!library.isSubtreeScanned(folder.id)) {
    toastService.info('Поддерево ещё не готово')
    return
  }

  const tracks = library.getAllTracksInFolderRecursive(folder.id)
  if (tracks.length === 0) return
  player.playAll(tracks)
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
  if (folder.totalTrackCount === 0) return
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

const getPlayLabel = (folder: Folder) => {
  if (isScanning(folder)) return `Сканирование ${folder.name}`
  if (folderPlayState(folder) === 'playing') return 'Пауза'
  if (folderPlayState(folder) === 'paused') return 'Продолжить'
  return `Играть папку ${folder.name}`
}

const getFolderButtonClass = (folder: Folder) => {
  if (isScanning(folder)) return 'bg-card-bg text-fg-muted cursor-default'
  if (isEmpty(folder) || folder.totalTrackCount === 0) return 'bg-card-bg text-fg-disabled cursor-default'
  if (folderPlayState(folder) === 'playing') return 'bg-active/20 text-active hover:bg-active/30'
  if (folderPlayState(folder) === 'paused') return 'bg-active/15 text-active hover:bg-active/25'
  return 'bg-card-bg text-fg-muted hover:bg-active/15 hover:text-active'
}
</script>

<template>
  <div v-if="currentSubfolders.length > 0" class="flex flex-col gap-0.5">
    <ListRow v-for="folder in currentSubfolders" :key="folder.id"
      :active="folderPlayState(folder) !== 'idle' && !isEmpty(folder)" :class="isEmpty(folder) ? 'opacity-40' : ''"
      @click="onRowClick(folder)">
      <template #leading>
        <div class="flex shrink-0 items-center gap-2">
          <!-- Кнопка Play/Pause -->
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition"
            :class="getFolderButtonClass(folder)" :aria-label="getPlayLabel(folder)" v-tooltip="getPlayLabel(folder)"
            @click.stop="toggleFolderPlayback(folder, $event)">
            <Icon v-if="isScanning(folder)" name="spinner" w="w-5" h="h-5" class="animate-spin" />
            <Icon v-else-if="folderPlayState(folder) === 'playing'" name="pause" w="w-5" h="h-5" />
            <Icon v-else name="play" w="w-5" h="h-5" class="translate-x-[1px]" />
          </div>

          <!-- Иконка папки -->
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn transition" :class="isScanning(folder)
            ? 'bg-card-bg text-fg-muted'
            : folderPlayState(folder) !== 'idle'
              ? 'bg-active/15 text-active'
              : 'bg-card-bg text-fg-muted'
            ">
            <Icon name="folder" w="w-5" h="h-5" />
          </div>
        </div>
      </template>

      <template #title>
        <p class="truncate text-sm font-medium">{{ folder.name }}</p>
      </template>

      <template #subtitle>
        <p class="truncate text-xs" :class="folderPlayState(folder) !== 'idle' && !isScanning(folder)
          ? 'text-active/60'
          : 'text-fg-muted'
          ">
          <template v-if="isScanning(folder)">Сканирование…</template>
          <template v-else-if="needsScan(folder)">Ожидает сканирования</template>
          <template v-else>{{ formatCount(folder) }}</template>
        </p>
      </template>

      <template #trailing>
        <div class="shrink-0" :class="[
          isScanning(folder) || isEmpty(folder)
            ? 'text-fg-disabled cursor-default'
            : folderPlayState(folder) !== 'idle'
              ? 'text-active/60 hover:bg-active/20 hover:text-active'
              : 'text-fg-subtle hover:bg-hover-bg hover:text-fg-muted',
        ]" :aria-label="`Открыть папку ${folder.name}`" v-tooltip="`Открыть папку ${folder.name}`"
          @click.stop="onArrowClick(folder, $event)">
          <Icon name="chevron-right" w="w-4" h="h-4" />
        </div>
      </template>
    </ListRow>
  </div>
</template>
