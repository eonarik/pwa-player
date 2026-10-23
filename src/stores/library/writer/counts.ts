// src/stores/library/writer/counts.ts

import type { Folder } from '@/types/library'
import type { useLibraryStore } from '../store'

type LibraryStore = ReturnType<typeof useLibraryStore>

/**
 * Пересчитывает totalTrackCount / totalTextFileCount ОДНОЙ папки
 * на основе её собственных треков/файлов и счётчиков детей.
 * НЕ поднимается к родителям — это делает recalcUpwards.
 */
export function recalcFolderCounters(s: LibraryStore, folderId: string): void {
  const folder = s.folders[folderId]
  if (!folder) return

  const ownTracks = folder.trackIds.length
  const ownFiles = folder.textFiles?.length ?? 0

  const childTracks = folder.childFolderIds.reduce((sum, id) => {
    const child = s.folders[id]
    return sum + (child?.totalTrackCount ?? 0)
  }, 0)

  const childFiles = folder.childFolderIds.reduce((sum, id) => {
    const child = s.folders[id]
    return sum + (child?.totalTextFileCount ?? 0)
  }, 0)

  s.folders[folderId] = {
    ...folder,
    totalTrackCount: ownTracks + childTracks,
    totalTextFileCount: ownFiles + childFiles,
  }
}

/**
 * Пересчитывает счётчики для указанных папок и всех их предков.
 * Порядок — от листьев к корню (иначе предок пересчитается раньше ребёнка).
 */
export function recalcUpwards(s: LibraryStore, startIds: Iterable<string>): void {
  const allAffected = new Set<string>()
  const stack = [...startIds]
  while (stack.length > 0) {
    const id = stack.pop()!
    if (allAffected.has(id)) continue
    allAffected.add(id)
    const folder: Folder | undefined = s.folders[id]
    if (folder?.parentId) stack.push(folder.parentId)
  }

  if (allAffected.size === 0) return

  const depth = new Map<string, number>()
  for (const id of allAffected) {
    let d = 0
    let current: string | null = id
    while (current && !depth.has(current)) {
      depth.set(current, d)
      const f: Folder | undefined = s.folders[current]
      current = f?.parentId ?? null
      d++
    }
  }

  const sorted = [...allAffected].sort((a, b) => (depth.get(a) ?? 0) - (depth.get(b) ?? 0))

  for (const id of sorted) {
    recalcFolderCounters(s, id)
  }
}
