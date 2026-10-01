// src/plugins/local/settings.ts

import { fileSystemService } from './FileSystemService'
import { localPersistenceService } from './persistence'
import { createLibraryWriter } from '@/stores/library'
import { folderIdFromPath } from '@/services/library/id'
import { toastService } from '@/services/ui/ToastService'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import type { PluginSettingsFolderEntry, PluginSettingsSchema } from '@/plugins/settingsTypes'

const PLUGIN_ID = 'local'

async function getFolderEntries(): Promise<PluginSettingsFolderEntry[]> {
  const handles = await fileSystemService.getHandles()
  const entries: PluginSettingsFolderEntry[] = []
  for (const h of handles) {
    let status: PluginSettingsFolderEntry['status'] = 'unknown'
    try {
      const q = await h.queryPermission({ mode: 'read' })
      status = q as PluginSettingsFolderEntry['status']
    } catch {
      status = 'unknown'
    }
    entries.push({ name: h.name, status })
  }
  return entries
}

export async function getLocalSettingsSchema(): Promise<PluginSettingsSchema> {
  const folders = await getFolderEntries()

  return {
    sections: [
      {
        id: 'local-folders',
        title: 'Локальные папки',
        description:
          'Папки с музыкой на этом устройстве. Можно добавить несколько. Папки с одинаковыми именами перезапишут друг друга.',
        fields: [
          {
            type: 'folderList',
            id: 'folders',
            folders,
          },
          {
            type: 'action',
            id: 'add-folder',
            label: 'Добавить папку',
            description: 'Выбрать папку на устройстве',
          },
        ],
      },
    ],
  }
}

export async function runLocalSettingsAction(actionId: string, payload?: unknown): Promise<void> {
  if (actionId === 'add-folder') {
    await addFolder()
    return
  }

  if (actionId === 'rescan-folder') {
    const { name } = (payload ?? {}) as { name?: string }
    if (!name) return
    await rescanFolder(name)
    return
  }

  if (actionId === 'remove-folder') {
    const { name } = (payload ?? {}) as { name?: string }
    if (!name) return
    await removeFolder(name)
    return
  }
}

// --- Действия --------------------------------------------------------

async function addFolder(): Promise<void> {
  try {
    const handle = await fileSystemService.pickDirectory()
    if (!handle) return

    const added = await fileSystemService.addHandle(handle)
    if (!added) {
      toastService.info(`Папка «${handle.name}» уже добавлена`)
      return
    }

    toastService.success(`Папка «${handle.name}» добавлена`)
    await rebuildAndSave()
  } catch (err) {
    console.error('[local-settings] add folder failed', err)
    toastService.error('Не удалось добавить папку')
  }
}

async function rescanFolder(name: string): Promise<void> {
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

    await rebuildAndSave()
    toastService.success(`Папка «${name}» обновлена`)
  } catch (err) {
    console.error('[local-settings] rescan failed', err)
    toastService.error('Не удалось обновить папку')
  }
}

async function removeFolder(name: string): Promise<void> {
  const confirmed = window.confirm(`Удалить папку «${name}» из библиотеки?`)
  if (!confirmed) return

  try {
    await fileSystemService.removeHandle(name)
    await rebuildAndSave()
    toastService.success(`Папка «${name}» удалена`)
  } catch (err) {
    console.error('[local-settings] remove failed', err)
    toastService.error('Не удалось удалить папку')
  }
}

// --- Пересбор библиотеки ---------------------------------------------

async function rebuildAndSave(): Promise<void> {
  const handles = await fileSystemService.getHandles()
  const writer = createLibraryWriter()

  const containerId = folderIdFromPath(PLUGIN_ID, '')
  const container: Folder = {
    id: containerId,
    name: 'Локальная папка',
    parentId: null,
    path: '',
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    source: PLUGIN_ID,
    scanStatus: 'scanned',
    ready: true,
  }

  const allFolders: Folder[] = [container]
  const allTracks: LibraryTrack[] = []

  for (const handle of handles) {
    const granted = await fileSystemService.verifyPermission(handle, 'read')
    if (!granted) continue

    const rootId = `${PLUGIN_ID}:${handle.name}`

    try {
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
    } catch (err) {
      console.error(`[local-settings] failed to scan "${handle.name}"`, err)
    }
  }

  const full: CollectedLibrary = {
    folders: allFolders,
    tracks: allTracks,
    rootFolderId: containerId,
    rootFolderName: 'Локальная папка',
  }

  writer.setLibrary(full, PLUGIN_ID)

  // Сохраняем всё, включая контейнер (без handle)
  await localPersistenceService.save({
    folders: full.folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: f.path,
      handle: f.handle,
      childFolderIds: [...f.childFolderIds],
      trackIds: [...f.trackIds],
      totalTrackCount: f.totalTrackCount,
      source: f.source ?? PLUGIN_ID,
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
