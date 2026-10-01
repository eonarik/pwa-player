<!-- src/plugins/local/LocalSettings.vue -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fileSystemService } from './FileSystemService'
import { localPersistenceService } from './persistence'
import { createLibraryWriter } from '@/stores/library'
import { toastService } from '@/services/ui/ToastService'
import { folderIdFromPath } from '@/services/library/id'
import type { CollectedLibrary, Folder } from '@/types/library'

interface FolderEntry {
  name: string
  status: 'granted' | 'prompt' | 'denied' | 'unknown'
}

const folders = ref<FolderEntry[]>([])
const isAdding = ref(false)
const busyFolder = ref<string | null>(null)

const isEmpty = computed(() => folders.value.length === 0)

async function refreshFolders() {
  const handles = await fileSystemService.getHandles()
  const entries: FolderEntry[] = []
  for (const h of handles) {
    let status: FolderEntry['status'] = 'unknown'
    try {
      const q = await h.queryPermission({ mode: 'read' })
      status = q as FolderEntry['status']
    } catch {
      status = 'unknown'
    }
    entries.push({ name: h.name, status })
  }
  folders.value = entries
}

onMounted(() => {
  void refreshFolders()
})

function statusLabel(status: FolderEntry['status']): string {
  if (status === 'granted') return 'Доступ есть'
  if (status === 'prompt') return 'Требуется подтверждение'
  if (status === 'denied') return 'Доступ запрещён'
  return 'Неизвестно'
}

function statusClass(status: FolderEntry['status']): string {
  if (status === 'granted') return 'text-fg-muted'
  if (status === 'prompt') return 'text-amber-400'
  return 'text-red-400'
}

// --- Добавление ------------------------------------------------------

async function addFolder() {
  if (isAdding.value) return
  isAdding.value = true
  try {
    const handle = await fileSystemService.pickDirectory()
    if (!handle) return

    const added = await fileSystemService.addHandle(handle)
    if (!added) {
      toastService.info(`Папка «${handle.name}» уже добавлена`)
      return
    }

    toastService.success(`Папка «${handle.name}» добавлена`)

    // Сразу сканируем
    await scanFolder(handle.name)
    await refreshFolders()
  } catch (err) {
    console.error('[local-settings] add folder failed', err)
    toastService.error('Не удалось добавить папку')
  } finally {
    isAdding.value = false
  }
}

// --- Пересканирование ------------------------------------------------

async function scanFolder(name: string) {
  if (busyFolder.value) return
  busyFolder.value = name

  try {
    const handles = await fileSystemService.getHandles()
    const handle = handles.find((h) => h.name === name)
    if (!handle) {
      toastService.error('Папка не найдена')
      return
    }

    const granted = await fileSystemService.verifyPermission(handle, 'read')
    if (!granted) {
      toastService.error('Нет доступа к папке')
      return
    }

    const rootId = `local:${handle.name}`
    const collected = await fileSystemService.collectLibrary(handle, rootId)

    // Сохраняем через writer и persistence
    await rebuildAndSave()

    toastService.success(`Папка «${name}» обновлена`)
  } catch (err) {
    console.error('[local-settings] scan failed', err)
    toastService.error('Не удалось обновить папку')
  } finally {
    busyFolder.value = null
  }
}

/** Полный пересбор всех папок и сохранение */
async function rebuildAndSave() {
  const handles = await fileSystemService.getHandles()
  const writer = createLibraryWriter()

  const containerId = folderIdFromPath('local', '')
  const container: Folder = {
    id: containerId,
    name: 'Локальная папка',
    parentId: null,
    path: '',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: 'local',
    scanStatus: 'scanned',
    ready: true,
  }

  const allFolders: Folder[] = [container]
  const allTracks: import('@/types/library').LibraryTrack[] = []

  for (const handle of handles) {
    const granted = await fileSystemService.verifyPermission(handle, 'read')
    if (!granted) continue

    const rootId = `local:${handle.name}`
    const collected = await fileSystemService.collectLibrary(handle, rootId)

    for (const folder of collected.folders) {
      if (folder.parentId === null) {
        folder.parentId = containerId
        container.childFolderIds.push(folder.id)
      }
    }

    allFolders.push(...collected.folders)
    allTracks.push(...collected.tracks)
    container.totalTrackCount += collected.tracks.length
  }

  const full: CollectedLibrary = {
    folders: allFolders,
    tracks: allTracks,
    rootFolderId: containerId,
    rootFolderName: 'Локальная папка',
  }

  writer.setLibrary(full, 'local')

  // Persistence — сохраняем тем же форматом, что и плагин
  // (импортируем toPersisted через плагин нельзя — сделаем минимум)
  await localPersistenceService.save({
    folders: full.folders
      .filter((f) => f.handle)
      .map((f) => ({
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
        handle: f.handle!,
        childFolderIds: [...f.childFolderIds],
        trackIds: [...f.trackIds],
        totalTrackCount: f.totalTrackCount,
        source: f.source ?? 'local',
      })),
    tracks: full.tracks
      .filter((t) => t.handle)
      .map((t) => ({
        id: t.id,
        pluginId: t.pluginId,
        folderId: t.folderId,
        title: t.title,
        artist: t.artist,
        album: t.album,
        year: t.year,
        trackNumber: t.trackNumber,
        genre: t.genre,
        duration: t.duration,
        codec: t.codec,
        filename: t.filename,
        path: t.path!,
        handle: t.handle,
      })),
    rootFolderId: full.rootFolderId,
    rootFolderName: full.rootFolderName,
    savedAt: Date.now(),
  })
}

// --- Удаление --------------------------------------------------------

async function removeFolder(name: string) {
  const confirmed = window.confirm(`Удалить папку «${name}» из библиотеки?`)
  if (!confirmed) return

  try {
    await fileSystemService.removeHandle(name)

    const writer = createLibraryWriter()
    writer.removeBySource(`local:${name}`)

    await rebuildAndSave()
    await refreshFolders()

    toastService.success(`Папка «${name}» удалена`)
  } catch (err) {
    console.error('[local-settings] remove failed', err)
    toastService.error('Не удалось удалить папку')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Пусто -->
    <div v-if="isEmpty" class="text-xs text-fg-muted">
      Папок нет. Добавьте первую.
    </div>

    <!-- Список -->
    <div v-else class="flex flex-col gap-2">
      <div v-for="folder in folders" :key="folder.name"
        class="flex items-center justify-between gap-3 bg-bg-elevated px-3 py-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-fg">{{ folder.name }}</p>
          <p class="text-xs" :class="statusClass(folder.status)">
            {{ statusLabel(folder.status) }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-1">
          <button type="button"
            class="rounded-btn px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-fg disabled:opacity-50"
            :disabled="busyFolder !== null" @click="scanFolder(folder.name)">
            {{ busyFolder === folder.name ? '…' : 'Обновить' }}
          </button>

          <button type="button"
            class="rounded-btn px-2 py-1 text-xs text-fg-muted transition hover:bg-hover-bg hover:text-red-400"
            :disabled="busyFolder !== null" @click="removeFolder(folder.name)">
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Добавить -->
    <button type="button"
      class="rounded-btn bg-card-bg px-3 py-2 text-xs text-fg transition hover:bg-hover-bg disabled:opacity-50"
      :disabled="isAdding || busyFolder !== null" @click="addFolder">
      {{ isAdding ? 'Добавление…' : '+ Добавить папку' }}
    </button>
  </div>
</template>
