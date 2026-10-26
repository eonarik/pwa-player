// src/plugins/yandexDisk/persist.ts

import type {
  CollectedLibrary,
  FileLocation,
  Folder,
  LibraryTrack,
  ScanState,
} from '@/types/library'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { getFileHandleFromPath } from '@/services/download/getFileFromPath'
import { migrateFileLocation, migrateScanState } from '@/services/library/migrations'
import type { PersistedYandexLibrary, IYandexService } from './types'

const ROOT_REMOTE_PATH = 'disk:/'

export function toPersisted(collected: CollectedLibrary): PersistedYandexLibrary {
  const folders = collected.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    remotePath: f.remotePath ?? '',
    childFolderIds: [...f.childFolderIds],
    trackIds: [...f.trackIds],
    totalTrackCount: f.totalTrackCount,
    totalTextFileCount: f.totalTextFileCount,
    scanState: f.scanState ?? 'pending',
    textFiles: f.textFiles?.map((t) => ({ name: t.name, remotePath: t.remotePath, path: t.path })),
  }))

  const tracks = []
  for (const t of collected.tracks) {
    const fileLocation: FileLocation = t.fileLocation ?? 'remote-only'
    const isLocal = fileLocation === 'local-only' || fileLocation === 'both'
    if (!t.remotePath && !isLocal) continue

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
      fileLocation,
      duration: t.duration,
      metaSource: t.metaSource,
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

export function fromPersisted(
  cached: PersistedYandexLibrary,
  service: IYandexService,
): CollectedLibrary {
  const folders: Folder[] = cached.folders.map((f) => {
    const scanState: ScanState = f.scanState ?? migrateScanState(f.scanStatus)
    return {
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: f.path,
      remotePath: f.remotePath,
      childFolderIds: [...f.childFolderIds],
      trackIds: [...f.trackIds],
      totalTrackCount: f.totalTrackCount,
      totalTextFileCount: f.totalTextFileCount,
      source: cached.folders[0]?.id.split(':')[1] || 'yandex',
      scanState,
      textFiles: f.textFiles,
    }
  })

  const tracks: LibraryTrack[] = cached.tracks.map((t) => {
    const cachedCover = metadataPersistenceService.get(t.id)?.coverUrl ?? undefined
    const source = t.remotePath ? service.buildDownloadUrl(t.remotePath) : ''
    const fileLocation: FileLocation = t.fileLocation ?? migrateFileLocation(t.origin)

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
      fileLocation,
      duration: t.duration,
      metaSource: t.metaSource,
    }
  })

  return {
    folders,
    tracks,
    rootFolderId: cached.rootFolderId,
    rootFolderName: cached.rootFolderName,
  }
}

export async function enrichWithLocalFiles(
  tracks: LibraryTrack[],
  targetDir: FileSystemDirectoryHandle,
  service?: IYandexService,
): Promise<void> {
  for (const track of tracks) {
    const location = track.fileLocation ?? 'remote-only'
    if (location !== 'local-only' && location !== 'both') continue

    const relativePath = track.path ?? track.filename
    const handle = await getFileHandleFromPath(targetDir, relativePath)

    if (handle) {
      track.handle = handle
      track.source = ''
    } else {
      track.handle = undefined
      track.fileLocation = 'remote-only'
      if (track.remotePath && service) {
        track.source = service.buildDownloadUrl(track.remotePath)
      } else {
        track.source = ''
      }
    }
  }
}
