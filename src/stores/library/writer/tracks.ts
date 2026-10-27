// src/stores/library/writer/tracks.ts

import type { FileLocation, LibraryTrack } from '@/types/library'
import { assertTrackInvariants } from '@/services/library/asserts'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { buildEntitiesForTrack } from '@/services/library/EntityGraph'
import type { useLibraryStore } from '../store'
import { recalcUpwards } from './counts'
import { deleteTrackWithRevoke } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'
import type { TrackSource } from '@/types/track'

type LibraryStore = ReturnType<typeof useLibraryStore>

/**
 * Собирает финальный трек с `fileLocation` по умолчанию.
 */
export function buildTrackWithLocation(track: LibraryTrack, pluginId: string): LibraryTrack {
  const fileLocation: FileLocation = track.fileLocation ?? 'remote-only'
  return { ...track, pluginId, fileLocation }
}

/**
 * Обновляет сущность альбома при добавлении/изменении трека.
 */
function syncAlbum(s: LibraryStore, track: LibraryTrack): LibraryTrack {
  const { track: trackWithAlbum, album } = buildEntitiesForTrack(track)

  if (album) {
    const existing = s.albums[album.id]
    if (existing) {
      if (!existing.trackIds.includes(trackWithAlbum.id)) {
        existing.trackIds.push(trackWithAlbum.id)
      }
      // Если у альбома нет обложки, но у трека появилась — берем её
      if (!existing.coverUrl && album.coverUrl) {
        existing.coverUrl = album.coverUrl
      }
      // Синхронизируем имя, если оно изменилось вручную
      existing.name = album.name
    } else {
      s.albums[album.id] = album
    }
  }

  return trackWithAlbum
}

export function addTracks(s: LibraryStore, tracks: LibraryTrack[], sourceId: string): void {
  const affectedFolders = new Set<string>()

  for (const track of tracks) {
    let next = buildTrackWithLocation(track, sourceId)
    assertTrackInvariants(next, 'addTracks')

    // Создаем/обновляем альбом
    next = syncAlbum(s, next)

    s.tracks[track.id] = next
    if (track.folderId) affectedFolders.add(track.folderId)
  }

  for (const folderId of affectedFolders) {
    const folder = s.folders[folderId]
    if (!folder) continue

    const newTrackIds = new Set(folder.trackIds)
    for (const track of tracks) {
      if (track.folderId === folderId) newTrackIds.add(track.id)
    }

    s.folders[folderId] = {
      ...folder,
      trackIds: Array.from(newTrackIds),
    }
  }

  if (affectedFolders.size > 0) {
    recalcUpwards(s, affectedFolders)
    for (const folderId of affectedFolders) {
      invalidateSubtreeCache(folderId, (id) => s.folders[id] ?? null)
    }
  }

  librarySaveService.scheduleSave(sourceId)
}

export function removeTracks(s: LibraryStore, trackIds: string[]): void {
  const idsSet = new Set(trackIds)
  const affectedFolderIds = new Set<string>()
  const pluginIds = new Set<string>()

  for (const id of trackIds) {
    const track = s.tracks[id]
    if (!track) continue
    if (track.folderId) affectedFolderIds.add(track.folderId)
    if (track.pluginId) pluginIds.add(track.pluginId)

    // Отвязываем от альбома
    if (track.albumId && s.albums[track.albumId]) {
      const album = s.albums[track.albumId]
      if (album) {
        album.trackIds = album.trackIds.filter((tid) => tid !== id)

        // Если альбом опустел — удаляем его
        if (album.trackIds.length === 0) {
          delete s.albums[track.albumId]
        }
      }
    }

    deleteTrackWithRevoke(s, id)
  }

  for (const folderId of affectedFolderIds) {
    const folder = s.folders[folderId]
    if (!folder) continue
    s.folders[folderId] = {
      ...folder,
      trackIds: folder.trackIds.filter((id) => !idsSet.has(id)),
    }
  }

  recalcUpwards(s, affectedFolderIds)
  for (const folderId of affectedFolderIds) {
    invalidateSubtreeCache(folderId, (id) => s.folders[id] ?? null)
  }

  for (const pluginId of pluginIds) {
    librarySaveService.scheduleSave(pluginId)
  }
}

export function updateTrackFileLocation(
  s: LibraryStore,
  trackId: string,
  location: FileLocation,
): void {
  const track = s.tracks[trackId]
  if (!track) return

  const next: LibraryTrack = { ...track, fileLocation: location }
  assertTrackInvariants(next, 'updateTrackFileLocation')
  s.tracks[trackId] = next

  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}

export function updateTrackHandle(
  s: LibraryStore,
  trackId: string,
  handle: FileSystemFileHandle | undefined,
): void {
  const track = s.tracks[trackId]
  if (!track) return

  const next: LibraryTrack = { ...track, handle }
  assertTrackInvariants(next, 'updateTrackHandle')
  s.tracks[trackId] = next

  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}

export function updateTrackSources(s: LibraryStore, trackId: string, sources: TrackSource[]): void {
  const track = s.tracks[trackId]
  if (!track) return
  s.tracks[trackId] = { ...track, sources }
  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}

export function updateTrackDuration(s: LibraryStore, trackId: string, duration: number): void {
  const track = s.tracks[trackId]
  if (!track) return
  if (track.duration === duration) return
  s.tracks[trackId] = { ...track, duration }
  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}

/**
 * Обновляет метаданные трека (включая возможный перенос в другой альбом).
 */
export function updateTrackMetadata(
  s: LibraryStore,
  trackId: string,
  patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'metaSource' | 'hasId3Tags'>>,
): void {
  const track = s.tracks[trackId]
  if (!track) return

  let next: LibraryTrack = { ...track, ...patch }

  if ('album' in patch || 'artist' in patch) {
    if (track.albumId) {
      const oldAlbum = s.albums[track.albumId]
      if (oldAlbum) {
        oldAlbum.trackIds = oldAlbum.trackIds.filter((id) => id !== trackId)
        if (oldAlbum.trackIds.length === 0) delete s.albums[track.albumId]
      }
    }
    next = syncAlbum(s, next)
  }

  s.tracks[trackId] = next
  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}
