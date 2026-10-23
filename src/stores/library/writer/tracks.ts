// src/stores/library/writer/tracks.ts

import type { FileLocation, LibraryTrack } from '@/types/library'
import { assertTrackInvariants } from '@/services/library/asserts'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import type { useLibraryStore } from '../store'
import { recalcUpwards } from './counts'
import { deleteTrackWithRevoke } from './helpers'
import { invalidateSubtreeCache } from '../subtreeCache'

type LibraryStore = ReturnType<typeof useLibraryStore>

/**
 * Собирает финальный трек с `fileLocation` по умолчанию.
 * Если плагин его не передал — считаем `remote-only`.
 */
export function buildTrackWithLocation(track: LibraryTrack, pluginId: string): LibraryTrack {
  const fileLocation: FileLocation = track.fileLocation ?? 'remote-only'
  return { ...track, pluginId, fileLocation }
}

export function addTracks(s: LibraryStore, tracks: LibraryTrack[], sourceId: string): void {
  const affectedFolders = new Set<string>()

  for (const track of tracks) {
    const next = buildTrackWithLocation(track, sourceId)
    assertTrackInvariants(next, 'addTracks')
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

export function updateTrackSource(s: LibraryStore, trackId: string, source: string): void {
  const track = s.tracks[trackId]
  if (!track) return
  const next: LibraryTrack = { ...track, source }
  assertTrackInvariants(next, 'updateTrackSource')
  s.tracks[trackId] = next
  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}

export function updateTrackDuration(s: LibraryStore, trackId: string, duration: number): void {
  const track = s.tracks[trackId]
  if (!track) return
  if (track.duration === duration) return
  s.tracks[trackId] = { ...track, duration }
  if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
}
