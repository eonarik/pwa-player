// src/stores/library/writer/folders.ts

import type { Folder, ScanState } from '@/types/library'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import type { useLibraryStore } from '../store'
import { recalcUpwards } from './counts'
import { deleteTrackWithRevoke, matchesSource, resetCurrentFolderIfDeleted } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'

type LibraryStore = ReturnType<typeof useLibraryStore>

export function buildFolderWithScanState(folder: Folder, sourceId: string): Folder {
  const scanState: ScanState = folder.scanState ?? 'pending'
  return {
    ...folder,
    source: folder.source ?? sourceId,
    scanState,
    trackIds: Array.from(new Set(folder.trackIds)),
    childFolderIds: Array.from(new Set(folder.childFolderIds)),
  }
}

export function addFolders(s: LibraryStore, folders: Folder[], sourceId: string): void {
  for (const folder of folders) {
    s.folders[folder.id] = buildFolderWithScanState(folder, sourceId)
    invalidateSubtreeCache(folder.id, (id) => s.folders[id] ?? null)
  }
  librarySaveService.scheduleSave(sourceId)
}

export function updateFolder(s: LibraryStore, folderId: string, patch: Partial<Folder>): void {
  const existing = s.folders[folderId]
  if (!existing) return

  const needsRecalc = 'trackIds' in patch || 'childFolderIds' in patch || 'textFiles' in patch

  s.folders[folderId] = { ...existing, ...patch }

  if (needsRecalc) {
    recalcUpwards(s, [folderId])
  }

  invalidateSubtreeCache(folderId, (id) => s.folders[id] ?? null)

  if (existing.source) librarySaveService.scheduleSave(existing.source)
}

export function removeFolders(s: LibraryStore, folderIds: string[]): void {
  const allFolderIds = new Set<string>()
  const allTrackIds = new Set<string>()
  const parentIds = new Set<string>()

  const collect = (id: string): void => {
    if (allFolderIds.has(id)) return
    const folder = s.folders[id]
    if (!folder) return

    allFolderIds.add(id)
    for (const trackId of folder.trackIds) allTrackIds.add(trackId)
    for (const childId of folder.childFolderIds) collect(childId)

    if (folder.parentId) parentIds.add(folder.parentId)
  }

  for (const id of folderIds) collect(id)

  const pluginIds = new Set<string>()
  for (const trackId of allTrackIds) {
    const pluginId = deleteTrackWithRevoke(s, trackId)
    if (pluginId) pluginIds.add(pluginId)
  }

  for (const id of allFolderIds) {
    const folder = s.folders[id]
    if (folder?.source) pluginIds.add(folder.source)
    delete s.folders[id]
  }

  for (const parentId of parentIds) {
    const parent = s.folders[parentId]
    if (!parent) continue
    s.folders[parentId] = {
      ...parent,
      childFolderIds: parent.childFolderIds.filter((id) => !allFolderIds.has(id)),
    }
  }

  recalcUpwards(s, parentIds)

  for (const id of allFolderIds) {
    invalidateSubtreeCache(id, (fid) => s.folders[fid] ?? null)
  }
  for (const parentId of parentIds) {
    invalidateSubtreeCache(parentId, (fid) => s.folders[fid] ?? null)
  }

  resetCurrentFolderIfDeleted(s)

  for (const pluginId of pluginIds) {
    librarySaveService.scheduleSave(pluginId)
  }
}

export function removeBySource(s: LibraryStore, sourceId: string): void {
  const pluginIds = new Set<string>()
  const removedFolderIds: string[] = []

  for (const [id, folder] of Object.entries(s.folders)) {
    if (matchesSource(folder.source, sourceId)) {
      if (folder.source) pluginIds.add(folder.source)
      removedFolderIds.push(id)
      delete s.folders[id]
    }
  }

  for (const [id, track] of Object.entries(s.tracks)) {
    if (matchesSource(track.pluginId, sourceId)) {
      if (track.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.coverUrl)
      }
      if (track.pluginId) pluginIds.add(track.pluginId)
      delete s.tracks[id]
    }
  }

  for (const id of removedFolderIds) {
    invalidateSubtreeCache(id, (fid) => s.folders[fid] ?? null)
  }

  resetCurrentFolderIfDeleted(s)
}
