// src/plugins/yandexDisk/scan.ts

import type { PluginContext, LibraryWriter } from '../types'
import type { Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import type { YandexResourceItem, IYandexService } from './types'
import { toPersisted } from './persist'

const ROOT_REMOTE_PATH = 'disk:/'

function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

interface PartitionedItems {
  subDirs: YandexResourceItem[]
  audioItems: YandexResourceItem[]
  textItems: YandexResourceItem[]
}

function partitionItems(items: YandexResourceItem[]): PartitionedItems {
  const subDirs: YandexResourceItem[] = []
  const audioItems: YandexResourceItem[] = []
  const textItems: YandexResourceItem[] = []

  for (const item of items) {
    if (item.type === 'dir') {
      subDirs.push(item)
    } else if (item.isAudio) {
      audioItems.push(item)
    } else if (item.type === 'file' && isTextFile(item.name)) {
      textItems.push(item)
    }
  }

  return { subDirs, audioItems, textItems }
}

function buildTrack(
  folder: Folder,
  item: YandexResourceItem,
  sourceId: string,
  service: IYandexService,
): LibraryTrack {
  const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name
  const trackId = trackIdFromPath(sourceId, trackPath)
  const cachedCover = metadataPersistenceService.get(trackId)?.coverUrl ?? undefined

  return {
    id: trackId,
    pluginId: sourceId,
    folderId: folder.id,
    filename: item.name,
    path: trackPath,
    remotePath: item.path,
    source: service.buildDownloadUrl(item.path),
    title: titleFromFilename(item.name),
    artist: '',
    album: folder.name ?? '',
    coverUrl: cachedCover,
  }
}

function buildTextFile(folder: Folder, item: YandexResourceItem): TextFileRef {
  const textPath = folder.path ? `${folder.path}/${item.name}` : item.name
  return {
    name: item.name,
    remotePath: item.path,
    path: textPath,
  }
}

function ensureSubFolders(
  context: PluginContext,
  parent: Folder,
  subDirs: YandexResourceItem[],
  sourceId: string,
): { childFolderIds: string[]; newFolders: Folder[] } {
  const childFolderIds: string[] = []
  const newFolders: Folder[] = []

  for (const item of subDirs) {
    const childPath = parent.path ? `${parent.path}/${item.name}` : item.name
    const childId = folderIdFromPath(sourceId, childPath)

    let childFolder = context.writer.getFolder(childId)
    if (!childFolder) {
      childFolder = {
        id: childId,
        name: item.name,
        parentId: parent.id,
        path: childPath,
        remotePath: item.path,
        childFolderIds: [],
        trackIds: [],
        totalTrackCount: 0,
        totalTextFileCount: 0,
        source: sourceId,
        scanStatus: undefined,
        ready: false,
      }
      newFolders.push(childFolder)
    }
    childFolderIds.push(childId)
  }

  return { childFolderIds, newFolders }
}

export function mergeFolderContent(
  context: PluginContext,
  folder: Folder,
  items: YandexResourceItem[],
  removeMissing: boolean,
  sourceId: string,
  service: IYandexService,
): void {
  // Если нас отменили — прерываемся
  if (service.isCancelled && service.isCancelled()) return

  const { subDirs, audioItems, textItems } = partitionItems(items)

  const remoteTrackIds: string[] = []
  const newTracks: LibraryTrack[] = []

  for (const item of audioItems) {
    const track = buildTrack(folder, item, sourceId, service)
    if (!context.writer.getTrack(track.id)) {
      newTracks.push(track)
    }
    remoteTrackIds.push(track.id)
  }

  const textFiles: TextFileRef[] = textItems.map((item) => buildTextFile(folder, item))
  const { childFolderIds, newFolders } = ensureSubFolders(context, folder, subDirs, sourceId)

  if (newTracks.length > 0) context.writer.addTracks(newTracks, sourceId)
  if (newFolders.length > 0) context.writer.addFolders(newFolders, sourceId)

  const onlyLocalIds = folder.trackIds.filter((id) => {
    const t = context.writer.getTrack(id)
    return t?.origin === 'only-local'
  })

  let finalTrackIds: string[]
  if (removeMissing) {
    const currentRemoteIds = folder.trackIds.filter((id) => {
      const t = context.writer.getTrack(id)
      return t && t.origin !== 'only-local'
    })
    const removed = currentRemoteIds.filter((id) => !remoteTrackIds.includes(id))
    if (removed.length > 0) {
      context.writer.removeTracks(removed)
    }
    finalTrackIds = [...remoteTrackIds, ...onlyLocalIds]
  } else {
    const existing = new Set(folder.trackIds)
    const added = remoteTrackIds.filter((id) => !existing.has(id))
    finalTrackIds = Array.from(new Set([...folder.trackIds, ...added]))
  }

  if (removeMissing) {
    const removedFolderIds = folder.childFolderIds.filter((id) => !childFolderIds.includes(id))
    for (const removedId of removedFolderIds) {
      removeSubtree(context, removedId)
    }
  }

  context.writer.updateFolder(folder.id, {
    childFolderIds: removeMissing
      ? childFolderIds
      : Array.from(new Set([...folder.childFolderIds, ...childFolderIds])),
    trackIds: finalTrackIds,
    textFiles,
    totalTextFileCount: textFiles.length,
  })
}

export function removeSubtree(context: PluginContext, folderId: string): void {
  const folder = context.writer.getFolder(folderId)
  if (!folder) return

  const tracksToRemove: string[] = []
  const foldersToRemove: string[] = []

  const walk = (id: string): void => {
    const f = context.writer.getFolder(id)
    if (!f) return

    for (const trackId of f.trackIds) {
      tracksToRemove.push(trackId)
    }
    foldersToRemove.push(f.id)

    for (const childId of f.childFolderIds) {
      walk(childId)
    }
  }

  walk(folderId)

  if (tracksToRemove.length > 0) context.writer.removeTracks(tracksToRemove)
  if (foldersToRemove.length > 0) context.writer.removeFolders(foldersToRemove)
}

export async function refreshSubtree(
  context: PluginContext,
  rootFolder: Folder,
  sourceId: string,
  service: IYandexService,
): Promise<{ tracks: number; files: number }> {
  const walk = async (folder: Folder): Promise<{ tracks: number; files: number }> => {
    // Проверка отмены
    if (service.isCancelled && service.isCancelled()) return { tracks: 0, files: 0 }
    if (!folder.remotePath) return { tracks: 0, files: 0 }

    let response
    try {
      response = await service.listResources(folder.remotePath)
    } catch (err) {
      console.warn(
        `[${sourceId}] skip folder "${folder.path}": ${err instanceof Error ? err.message : err}`,
      )
      return { tracks: 0, files: 0 }
    }

    // Повторная проверка, так как пока ждали fetch, нас могли отменить
    if (service.isCancelled && service.isCancelled()) return { tracks: 0, files: 0 }

    mergeFolderContent(
      context,
      folder,
      response._embedded?.items || response.items || [],
      true,
      sourceId,
      service,
    )

    const updated = context.writer.getFolder(folder.id)
    if (!updated) return { tracks: 0, files: 0 }

    const childFolders = updated.childFolderIds
      .map((id) => context.writer.getFolder(id))
      .filter((f): f is Folder => Boolean(f))

    const CONCURRENCY = 5
    let cursor = 0
    const childResults: Array<{ tracks: number; files: number }> = Array.from({
      length: childFolders.length,
    })

    const worker = async (): Promise<void> => {
      while (cursor < childFolders.length) {
        if (service.isCancelled && service.isCancelled()) break
        const i = cursor++
        const child = childFolders[i]!
        childResults[i] = await walk(child)
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, childFolders.length) }, () => worker()),
    )

    // Если нас отменили прямо сейчас, выходим, чтобы не обновлять сломанные данные
    if (service.isCancelled && service.isCancelled()) return { tracks: 0, files: 0 }

    let childTracks = 0
    let childFiles = 0
    for (const r of childResults) {
      if (!r) continue
      childTracks += r.tracks
      childFiles += r.files
    }

    const totalTracks = updated.trackIds.length + childTracks
    const totalFiles = (updated.textFiles?.length ?? 0) + childFiles

    context.writer.updateFolder(folder.id, {
      totalTrackCount: totalTracks,
      totalTextFileCount: totalFiles,
      scanStatus: 'scanned',
      ready: true,
    })

    return { tracks: totalTracks, files: totalFiles }
  }

  return walk(rootFolder)
}

export async function loadRootContent(
  sourceId: string,
  rootFolderId: string,
  service: IYandexService,
): Promise<{
  folders: Folder[]
  tracks: LibraryTrack[]
}> {
  const response = await service.listResources(ROOT_REMOTE_PATH)

  const folders: Folder[] = []
  const tracks: LibraryTrack[] = []
  const childFolderIds: string[] = []
  const trackIds: string[] = []

  const { subDirs, audioItems, textItems } = partitionItems(
    response._embedded?.items || response.items || [],
  )

  const rootFolder: Folder = {
    id: rootFolderId,
    name: 'Яндекс.Диск',
    parentId: null,
    path: '',
    remotePath: ROOT_REMOTE_PATH,
    childFolderIds: [],
    trackIds: [],
    totalTrackCount: 0,
    totalTextFileCount: 0,
    source: sourceId,
    scanStatus: 'scanned',
    ready: false,
  }

  for (const item of subDirs) {
    const childPath = item.name
    const childId = folderIdFromPath(sourceId, childPath)
    folders.push({
      id: childId,
      name: item.name,
      parentId: rootFolderId,
      path: childPath,
      remotePath: item.path,
      childFolderIds: [],
      trackIds: [],
      totalTrackCount: 0,
      totalTextFileCount: 0,
      source: sourceId,
      scanStatus: undefined,
      ready: false,
    })
    childFolderIds.push(childId)
  }

  for (const item of audioItems) {
    const track = buildTrack(rootFolder, item, sourceId, service)
    tracks.push(track)
    trackIds.push(track.id)
  }

  const textFiles: TextFileRef[] = textItems.map((item) => buildTextFile(rootFolder, item))

  rootFolder.childFolderIds = childFolderIds
  rootFolder.trackIds = trackIds
  rootFolder.totalTrackCount = trackIds.length
  rootFolder.totalTextFileCount = textFiles.length
  rootFolder.textFiles = textFiles

  return {
    folders: [rootFolder, ...folders],
    tracks,
  }
}

export async function backgroundScan(
  context: PluginContext,
  sourceId: string,
  service: IYandexService,
): Promise<void> {
  if (service.isCancelled && service.isCancelled()) return

  const allFolders = context.writer.getFoldersBySource(sourceId)
  const unready = allFolders.filter((f) => f.ready !== true)

  if (unready.length === 0) return

  const rootFolder = allFolders.find((f) => f.parentId === null)
  if (!rootFolder) return

  await refreshSubtree(context, rootFolder, sourceId, service)

  if (service.isCancelled && service.isCancelled()) return

  await import('./persistence').then(({ yandexPersistenceService }) =>
    yandexPersistenceService.save(
      sourceId,
      toPersisted(currentLibraryFromWriter(context, sourceId)),
    ),
  )
}

export function findNearestFolder(
  writer: LibraryWriter,
  sourceId: string,
  relativePath: string,
): Folder | null {
  const segments = relativePath.split('/').filter(Boolean)
  segments.pop()

  const folders = writer.getFoldersBySource(sourceId)

  while (segments.length > 0) {
    const candidatePath = segments.join('/')
    const folder = folders.find((f) => f.path === candidatePath)
    if (folder) return folder
    segments.pop()
  }

  return folders.find((f) => f.parentId === null) ?? null
}

export function currentLibraryFromWriter(
  context: PluginContext,
  sourceId: string,
): {
  folders: Folder[]
  tracks: LibraryTrack[]
  rootFolderId: string
  rootFolderName: string
} {
  const folders = context.writer.getFoldersBySource(sourceId)
  const tracks = context.writer.getTracksBySource(sourceId)
  return {
    folders,
    tracks,
    rootFolderId: folders.find((f) => f.parentId === null)?.id ?? '',
    rootFolderName: 'Яндекс.Диск',
  }
}
