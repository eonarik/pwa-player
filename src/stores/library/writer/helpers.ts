// src/stores/library/writer/helpers.ts

import type { Folder } from '@/types/library'
import type { useLibraryStore } from '../store'

type LibraryStore = ReturnType<typeof useLibraryStore>

export function matchesSource(source: string | undefined, sourceId: string): boolean {
  if (!source) return false
  return source === sourceId || source.startsWith(sourceId + ':')
}

/**
 * Удаляет трек и revoke'ает его blob-обложку.
 * Возвращает pluginId удалённого трека (для scheduleSave) или null.
 */
export function deleteTrackWithRevoke(s: LibraryStore, trackId: string): string | null {
  const track = s.tracks[trackId]
  if (!track) return null

  if (track.coverUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(track.coverUrl)
  }
  const pluginId = track.pluginId ?? null
  delete s.tracks[trackId]
  return pluginId
}

/**
 * Сбрасывает currentFolderId, если папка была удалена.
 */
export function resetCurrentFolderIfDeleted(s: LibraryStore): void {
  if (s.currentFolderId && !s.folders[s.currentFolderId]) {
    s.currentFolderId = null
  }
}

/**
 * Возвращает папку и всех её предков (для инвалидации кэша).
 */
export function collectWithAncestors(s: LibraryStore, folderId: string): Folder[] {
  const result: Folder[] = []
  const visited = new Set<string>()
  let current: string | null = folderId

  while (current && !visited.has(current)) {
    visited.add(current)
    const folder: Folder | undefined = s.folders[current]
    if (!folder) break
    result.push(folder)
    current = folder.parentId
  }

  return result
}
