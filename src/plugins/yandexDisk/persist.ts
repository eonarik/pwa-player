// src/plugins/yandexDisk/persist.ts

import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import { PLUGIN_ID } from './constants'
import { yandexDiskService } from './YandexDiskService'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import type { PersistedYandexFolder, PersistedYandexLibrary, PersistedYandexTrack } from './types'

const ROOT_REMOTE_PATH = 'disk:/'

// --- Сериализация -----------------------------------------------------

export function toPersisted(collected: CollectedLibrary): PersistedYandexLibrary {
  const folders: PersistedYandexFolder[] = collected.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    remotePath: f.remotePath ?? '',
    childFolderIds: [...f.childFolderIds],
    trackIds: [...f.trackIds],
    totalTrackCount: f.totalTrackCount,
    totalTextFileCount: f.totalTextFileCount,
    scanStatus: f.scanStatus,
    ready: f.ready,
    // Vue reactive proxy не клонируется через structuredClone —
    // разворачиваем каждый элемент в plain object.
    textFiles: f.textFiles
      ? f.textFiles.map((t) => ({
          name: t.name,
          remotePath: t.remotePath,
          path: t.path,
        }))
      : undefined,
  }))

  const tracks: PersistedYandexTrack[] = []
  for (const t of collected.tracks) {
    const isOnlyLocal = t.origin === 'only-local'
    if (!t.remotePath && !isOnlyLocal) continue

    tracks.push({
      id: t.id,
      pluginId: t.pluginId,
      folderId: t.folderId,
      filename: t.filename,
      path: t.path!,
      remotePath: t.remotePath ?? '',
      title: t.title,
      artist: t.artist,
      album: t.album,
      origin: t.origin,
      duration: t.duration,
    })
  }

  return {
    folders,
    tracks,
    rootFolderId: collected.rootFolderId,
    rootFolderName: collected.rootFolderName,
    rootPath: ROOT_REMOTE_PATH,
    savedAt: Date.now(),
  }
}

// --- Десериализация ---------------------------------------------------

export function fromPersisted(cached: PersistedYandexLibrary): CollectedLibrary {
  const folders: Folder[] = cached.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    remotePath: f.remotePath,
    childFolderIds: [...f.childFolderIds],
    trackIds: [...f.trackIds],
    totalTrackCount: f.totalTrackCount,
    totalTextFileCount: f.totalTextFileCount,
    source: PLUGIN_ID,
    scanStatus: f.scanStatus === 'scanning' ? undefined : f.scanStatus,
    ready: f.ready,
    textFiles: f.textFiles,
  }))

  const tracks: LibraryTrack[] = cached.tracks.map((t) => {
    const cachedCover = metadataPersistenceService.get(t.id)?.coverUrl ?? undefined
    const source = t.remotePath ? yandexDiskService.buildDownloadUrl(t.remotePath) : ''

    return {
      id: t.id,
      pluginId: t.pluginId,
      folderId: t.folderId,
      filename: t.filename,
      path: t.path,
      remotePath: t.remotePath || undefined,
      source,
      title: t.title,
      artist: t.artist,
      album: t.album,
      coverUrl: cachedCover,
      origin: t.origin,
      duration: t.duration,
    }
  })

  return {
    folders,
    tracks,
    rootFolderId: cached.rootFolderId,
    rootFolderName: cached.rootFolderName,
  }
}

// --- Локальные файлы --------------------------------------------------

/**
 * Для треков со status 'downloaded' / 'only-local' подтягивает File
 * из папки скачивания. Если файла нет — откатывает origin в 'remote'.
 */
export async function enrichWithLocalFiles(
  tracks: LibraryTrack[],
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  for (const track of tracks) {
    if (track.origin !== 'downloaded' && track.origin !== 'only-local') continue

    const relativePath = track.path ?? track.filename
    const file = await getFileFromPath(targetDir, relativePath)

    if (file) {
      track.source = file
    } else {
      track.origin = 'remote'
    }
  }
}
