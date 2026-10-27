// src/stores/library/writer/library.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { CollectedLibrary } from '@/types/library'
import type { useLibraryStore } from '../store'
import { buildFolderWithScanState } from './folders'
import { buildTrackWithLocation } from './tracks'
import { matchesSource, resetCurrentFolderIfDeleted } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'
import { assertTrackInvariants } from '@/services/library/asserts'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { buildEntitiesForTrack } from '@/services/library/EntityGraph'
import { reconciliationService } from '@/services/library/ReconciliationService'

type LibraryStore = ReturnType<typeof useLibraryStore>

export function setLibrary(s: LibraryStore, collected: CollectedLibrary, sourceId: string): void {
  // 1. Запоминаем albumId и sources старых треков, чтобы не потерять их при сканировании
  const savedMeta = new Map<string, { albumId?: string; sources?: any[] }>()

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

  // 2. Очищаем старые данные этого источника
  for (const [id, folder] of Object.entries(s.folders)) {
    if (matchesSource(folder.source, sourceId)) delete s.folders[id]
  }

  for (const [id, track] of Object.entries(s.tracks)) {
    if (matchesSource(track.pluginId, sourceId)) {
      if (track.raw?.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.raw.coverUrl)
      }

      // Отвязываем от альбома
      if (track.albumId) {
        const album = s.albums[track.albumId]
        if (album) {
          album.trackIds = album.trackIds.filter((tid) => tid !== id)
          if (album.trackIds.length === 0) {
            delete s.albums[track.albumId]
          }
        }
      }

      delete s.tracks[id]
    }
  }

  // 3. Добавляем новые папки
  for (const folder of collected.folders) {
    s.folders[folder.id] = buildFolderWithScanState(folder, sourceId)
  }

  // 4. Добавляем новые треки
  for (const track of collected.tracks) {
    let next = buildTrackWithLocation(track, sourceId)

    // Восстанавливаем albumId и sources из памяти
    const saved = savedMeta.get(next.id)
    if (saved) {
      if (saved.albumId && !next.albumId) {
        next.albumId = saved.albumId
        const album = s.albums[saved.albumId]
        if (album) {
          next.album = album.name
        }
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

    // Создаем/обновляем альбом (если у трека появились данные)
    const { track: trackWithAlbum, album } = buildEntitiesForTrack(next)
    next = trackWithAlbum

    if (album) {
      const existing = s.albums[album.id]
      if (existing) {
        if (!existing.trackIds.includes(next.id)) {
          existing.trackIds.push(next.id)
        }
        if (!existing.coverUrl && album.coverUrl) {
          existing.coverUrl = album.coverUrl
        }
        existing.name = album.name
      } else {
        s.albums[album.id] = album
      }
    }

    s.tracks[next.id] = next
  }

  // 5. Мержим альбомы, которые пришли от плагина (если есть)
  if (collected.albums) {
    for (const album of collected.albums) {
      const existing = s.albums[album.id]
      if (existing) {
        const newIds = new Set([...existing.trackIds, ...album.trackIds])
        existing.trackIds = Array.from(newIds)
        if (!existing.coverUrl && album.coverUrl) existing.coverUrl = album.coverUrl
      } else {
        s.albums[album.id] = album
      }
    }
  }

  for (const folder of collected.folders) {
    invalidateSubtreeCache(folder.id, (id) => s.folders[id] ?? null)
  }

  resetCurrentFolderIfDeleted(s)

  librarySaveService.scheduleSave(sourceId)

  // 6. Запускаем фоновую склейку
  if (collected.tracks.length > 0) {
    void reconciliationService.reconcile()
  }
}
