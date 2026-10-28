// src/stores/library/writer/library.ts

import type { Album, CollectedLibrary } from '@/types/library'
import type { useLibraryStore } from '../store'
import { buildFolderWithScanState } from './folders'
import { buildTrackWithLocation } from './tracks'
import { matchesSource, resetCurrentFolderIfDeleted } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'
import { assertTrackInvariants } from '@/services/library/asserts'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { buildEntitiesForTrack, createAlbumId } from '@/services/library/EntityGraph'
import { reconciliationService } from '@/services/library/ReconciliationService'
import type { TrackSource } from "@/types/track"

type LibraryStore = ReturnType<typeof useLibraryStore>

export function setLibrary(s: LibraryStore, collected: CollectedLibrary, sourceId: string): void {
  const savedMeta = new Map<string, { albumId?: string; sources?: TrackSource[] }>()

  for (const [id, track] of Object.entries(s.tracks)) {
    if (matchesSource(track.pluginId, sourceId)) {
      if (track.albumId || (track.sources && track.sources.length > 0)) {
        savedMeta.set(id, {
          albumId: track.albumId,
          sources: track.sources ? JSON.parse(JSON.stringify(track.sources)) : undefined,
        })
      }
    }
  }

  for (const [id, folder] of Object.entries(s.folders)) {
    if (matchesSource(folder.source, sourceId)) delete s.folders[id]
  }

  for (const [id, track] of Object.entries(s.tracks)) {
    if (matchesSource(track.pluginId, sourceId)) {
      if (track.raw?.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.raw.coverUrl)
      }

      if (track.albumId) {
        const album = s.albums[track.albumId]
        if (album) {
          album.trackIds = album.trackIds.filter((tid) => tid !== id)
        }
      }
      delete s.tracks[id]
    }
  }

  for (const folder of collected.folders) {
    s.folders[folder.id] = buildFolderWithScanState(folder, sourceId)
  }

  for (const track of collected.tracks) {
    let next = buildTrackWithLocation(track, sourceId)

    const saved = savedMeta.get(next.id)
    if (saved) {
      if (saved.albumId && !next.albumId) {
        next.albumId = saved.albumId
        const album = s.albums[saved.albumId]
        if (album) next.album = album.name
      }
      if (saved.sources && saved.sources.length > 0) {
        const mergedSources = [...(next.sources || [])]
        for (const src of saved.sources) {
          if (!mergedSources.some((x) => x.id === src.id)) {
            mergedSources.push(src)
          }
        }
        mergedSources.sort((a, b) => a.priority - b.priority)
        next.sources = mergedSources
      }
    }

    assertTrackInvariants(next, 'setLibrary')

    // Если у трека нет albumId, ищем альбом в памяти
    let existingAlbum: Album | null = null
    if (next.albumId) {
      existingAlbum = s.albums[next.albumId] || null
    } else if (next.album) {
      const tempId = createAlbumId(next.album, next.artist)
      if (tempId) existingAlbum = s.albums[tempId] || null
    }

    const { track: trackWithAlbum, album } = buildEntitiesForTrack(next, existingAlbum)
    next = trackWithAlbum

    if (album) {
      const existing = s.albums[album.id]
      if (existing) {
        // Если альбом уже есть, не перезаписываем обложку, если она там есть
        if (!existing.coverUrl && album.coverUrl) existing.coverUrl = album.coverUrl
        if (!existing.trackIds.includes(next.id)) {
          existing.trackIds.push(next.id)
        }
      } else {
        s.albums[album.id] = album
      }
    }

    s.tracks[next.id] = next
  }

  for (const folder of collected.folders) {
    invalidateSubtreeCache(folder.id, (id) => s.folders[id] ?? null)
  }

  resetCurrentFolderIfDeleted(s)
  librarySaveService.scheduleSave(sourceId)

  if (collected.tracks.length > 0) {
    void reconciliationService.reconcile()
  }
}
