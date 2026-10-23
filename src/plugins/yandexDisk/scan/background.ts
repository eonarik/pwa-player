// src/plugins/yandexDisk/scan/background.ts

import type { PluginContext, LibraryWriter } from '../../types'
import type { Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { toPersisted } from '../persist'
import type { IYandexService } from '../types'
import { partitionItems, buildTrack, buildTextFile, ensureSubFolders } from './helpers'
import { mapWithConcurrency } from '../concurrency'

function isLocallyAvailable(track: LibraryTrack | null): boolean {
  if (!track) return false
  const loc = track.fileLocation ?? 'remote-only'
  return loc === 'local-only' || loc === 'both'
}

export function mergeFolderContent(
  context: PluginContext,
  folder: Folder,
  items: import('../types').YandexResourceItem[],
  removeMissing: boolean,
  sourceId: string,
  service: IYandexService,
): void {
  if (service.isCancelled && service.isCancelled()) return

  const { subDirs, audioItems, textItems } = partitionItems(items)

  const remoteTrackIdsSet = new Set<string>()
  const newTracks: LibraryTrack[] = []

  for (const item of audioItems) {
    const track = buildTrack(folder, item, sourceId, service)
    if (!context.writer.getTrack(track.id)) {
      newTracks.push(track)
    }
    remoteTrackIdsSet.add(track.id)
  }

  const remoteTrackIds = Array.from(remoteTrackIdsSet)

  const textFiles: TextFileRef[] = textItems.map((item) => buildTextFile(folder, item))
  const { childFolderIds, newFolders } = ensureSubFolders(context, folder, subDirs, sourceId)

  if (newTracks.length > 0) context.writer.addTracks(newTracks, sourceId)
  if (newFolders.length > 0) context.writer.addFolders(newFolders, sourceId)

  const localTrackIds = folder.trackIds.filter((id) => {
    const t = context.writer.getTrack(id)
    return isLocallyAvailable(t)
  })

  let finalTrackIds: string[]
  if (removeMissing) {
    const currentRemoteIds = folder.trackIds.filter((id) => {
      const t = context.writer.getTrack(id)
      return t && !isLocallyAvailable(t)
    })
    const removed = currentRemoteIds.filter((id) => !remoteTrackIds.includes(id))
    if (removed.length > 0) {
      context.writer.removeTracks(removed)
    }
    finalTrackIds = Array.from(new Set([...remoteTrackIds, ...localTrackIds]))
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
      ? Array.from(new Set(childFolderIds))
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

interface RefreshTotals {
  tracks: number
  files: number
}

const REFRESH_CONCURRENCY = 5

export async function refreshSubtree(
  context: PluginContext,
  rootFolder: Folder,
  sourceId: string,
  service: IYandexService,
): Promise<RefreshTotals> {
  const isCancelled = (): boolean => Boolean(service.isCancelled?.())

  const walk = async (folder: Folder): Promise<RefreshTotals> => {
    if (isCancelled()) return { tracks: 0, files: 0 }
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

    if (isCancelled()) return { tracks: 0, files: 0 }

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

    const childResults = await mapWithConcurrency(
      childFolders,
      REFRESH_CONCURRENCY,
      (child) => walk(child),
      { shouldStop: isCancelled },
    )

    if (isCancelled()) return { tracks: 0, files: 0 }

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
      scanState: 'scanned',
    })

    return { tracks: totalTracks, files: totalFiles }
  }

  return walk(rootFolder)
}

export async function backgroundScan(
  context: PluginContext,
  sourceId: string,
  service: IYandexService,
): Promise<void> {
  if (service.isCancelled && service.isCancelled()) return

  const allFolders = context.writer.getFoldersBySource(sourceId)
  const pending = allFolders.filter((f) => (f.scanState ?? 'pending') === 'pending')

  if (pending.length === 0) return

  const rootFolder = allFolders.find((f) => f.parentId === null)
  if (!rootFolder) return

  await refreshSubtree(context, rootFolder, sourceId, service)

  if (service.isCancelled && service.isCancelled()) return

  await import('../persistence').then(({ yandexPersistenceService }) =>
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
