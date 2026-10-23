// src/stores/library/writer/library.ts

import type { CollectedLibrary } from '@/types/library'
import type { useLibraryStore } from '../store'
import { buildFolderWithScanState } from './folders'
import { buildTrackWithLocation } from './tracks'
import { matchesSource, resetCurrentFolderIfDeleted } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'
import { assertTrackInvariants } from '@/services/library/asserts'
import { librarySaveService } from '@/services/library/LibrarySaveService'

type LibraryStore = ReturnType<typeof useLibraryStore>

export function setLibrary(s: LibraryStore, collected: CollectedLibrary, sourceId: string): void {
  for (const [id, folder] of Object.entries(s.folders)) {
    if (matchesSource(folder.source, sourceId)) delete s.folders[id]
  }

  for (const [id, track] of Object.entries(s.tracks)) {
    if (matchesSource(track.pluginId, sourceId)) {
      if (track.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.coverUrl)
      }
      delete s.tracks[id]
    }
  }

  for (const folder of collected.folders) {
    s.folders[folder.id] = buildFolderWithScanState(folder, sourceId)
  }

  for (const track of collected.tracks) {
    const next = buildTrackWithLocation(track, sourceId)
    assertTrackInvariants(next, 'setLibrary')
    s.tracks[track.id] = next
  }

  for (const folder of collected.folders) {
    invalidateSubtreeCache(folder.id, (id) => s.folders[id] ?? null)
  }

  resetCurrentFolderIfDeleted(s)

  librarySaveService.scheduleSave(sourceId)
}
