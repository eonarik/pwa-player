// src/stores/library/store.ts

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Folder, LibraryTrack, Album } from '@/types/library'
import type { Track, TrackSource } from '@/types/track'
import { virtualTracksService } from '@/services/persistence/VirtualTracksService'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { buildEntitiesForTrack } from '@/services/library/EntityGraph'
import { findBestMatch } from '@/services/playlists/PlaylistMatcher'
import { getPluginManifest } from '@/plugins/lookup'
import { sortService } from '@/services/sort/SortService'
import { isSubtreeScanned as isSubtreeScannedPure } from '@/services/library/selectors'
import { subtreeCache, clearSubtreeCache } from './subtreeCache'

export const useLibraryStore = defineStore('library', () => {
  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})
  const albums = ref<Record<string, Album>>({})
  const virtualTracks = ref<Record<string, LibraryTrack>>({})
  const currentFolderId = ref<string | null>(null)

  const hasLibrary = computed(() => Object.keys(folders.value).length > 0)

  const currentFolder = computed<Folder | null>(() => {
    if (!currentFolderId.value) return null
    return folders.value[currentFolderId.value] ?? null
  })

  const currentSubfolders = computed<Folder[]>(() => {
    const folder = currentFolder.value
    if (!folder) return []
    const list = folder.childFolderIds
      .map((id) => folders.value[id])
      .filter((f): f is Folder => Boolean(f))
    return sortService.sortByName(list)
  })

  const currentTracks = computed<LibraryTrack[]>(() => {
    const folder = currentFolder.value
    if (!folder) return []
    const seen = new Set<string>()
    const list: LibraryTrack[] = []
    for (const id of folder.trackIds) {
      if (seen.has(id)) continue
      seen.add(id)
      const track = tracks.value[id]
      if (track) list.push(track)
    }
    return sortService.sort(list)
  })

  const breadcrumbs = computed<Folder[]>(() => {
    const crumbs: Folder[] = []
    let folder = currentFolder.value
    const visited = new Set<string>()
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id)
      crumbs.unshift(folder)
      folder = folder.parentId ? (folders.value[folder.parentId] ?? null) : null
    }
    return crumbs
  })

  const canGoUp = computed(() => {
    const folder = currentFolder.value
    return Boolean(folder && folder.parentId)
  })

  /**
   * Ищет трек в библиотеке по artist+title.
   * Если находит — обогащает метаданные и добавляет новый source.
   * Если нет — создает виртуальный трек.
   * Возвращает ID трека в библиотеке.
   */
  function resolveOrCreateTrack(incoming: Track): string {
    // 1. Если это трек из самой библиотеки (не виртуальный)
    if (tracks.value[incoming.id] && !incoming.isVirtual) {
      return incoming.id
    }

    // 2. Ищем совпадения среди существующих треков
    const candidates = Object.values(tracks.value).filter((t) => !t.isVirtual)
    const { track: match, score } = findBestMatch(incoming, candidates, 0.8)

    const manifest = getPluginManifest(incoming.pluginId)
    const priority = manifest?.sourcePriority ?? 999

    const newSource: TrackSource = {
      id: incoming.id,
      pluginId: incoming.pluginId,
      url: incoming.sources?.[0]?.url,
      priority,
    }

    // 3. Если нашли совпадение — обогащаем и добавляем source
    if (match && score >= 0.8) {
      const existing = tracks.value[match.id]!

      if (!existing.album && incoming.album) existing.album = incoming.album
      if (!existing.artist && incoming.artist) existing.artist = incoming.artist

      // Берем обложку из самого трека или из raw
      const incomingCover = incoming.coverUrl || incoming.raw?.coverUrl

      if (!existing.albumId && existing.album) {
        const { track: updatedTrack, album: newAlbum } = buildEntitiesForTrack(existing)
        existing.albumId = updatedTrack.albumId

        if (newAlbum) {
          const existingAlbum = albums.value[newAlbum.id]
          if (existingAlbum) {
            if (!existingAlbum.trackIds.includes(existing.id)) {
              existingAlbum.trackIds.push(existing.id)
            }
            if (!existingAlbum.coverUrl && incomingCover) {
              existingAlbum.coverUrl = incomingCover
            }
          } else {
            newAlbum.coverUrl = incomingCover // <-- Берем из incoming
            albums.value[newAlbum.id] = newAlbum
          }
        }
      }

      const hasSource = existing.sources.some((s) => s.id === newSource.id)
      if (!hasSource) {
        existing.sources.push(newSource)
        existing.sources.sort((a, b) => a.priority - b.priority)
      }

      if (existing.albumId) {
        const album = albums.value[existing.albumId]
        if (album && !album.coverUrl && incomingCover) {
          album.coverUrl = incomingCover
        }
      }

      return existing.id
    }

    // 4. Если не нашли — создаем новый виртуальный трек
    const virtualId = incoming.id
    const next: LibraryTrack = {
      ...incoming,
      id: virtualId,
      folderId: 'virtual',
      isVirtual: true,
      sources: [newSource],
    }

    const { track: trackWithAlbum, album } = buildEntitiesForTrack(next)

    if (album) {
      const existingAlbum = albums.value[album.id]
      if (existingAlbum) {
        if (!existingAlbum.trackIds.includes(trackWithAlbum.id))
          existingAlbum.trackIds.push(trackWithAlbum.id)
        if (!existingAlbum.coverUrl && album.coverUrl) existingAlbum.coverUrl = album.coverUrl
      } else {
        albums.value[album.id] = album
      }
    }

    virtualTracks.value[trackWithAlbum.id] = trackWithAlbum
    tracks.value[trackWithAlbum.id] = trackWithAlbum

    void virtualTracksService.saveAll(virtualTracks.value)

    return trackWithAlbum.id
  }

  /**
   * Удаляет виртуальный трек.
   */
  function removeVirtualTrack(trackId: string): void {
    const track = virtualTracks.value[trackId]
    if (!track) return

    // Отвязываем от альбома
    if (track.albumId) {
      const album = albums.value[track.albumId]
      if (album) {
        album.trackIds = album.trackIds.filter((id) => id !== trackId)
        if (album.trackIds.length === 0) {
          delete albums.value[track.albumId]
        }
      }
    }

    delete virtualTracks.value[trackId]
    delete tracks.value[trackId]

    void virtualTracksService.saveAll(virtualTracks.value)
  }

  /**
   * Восстанавливает виртуальные треки из IndexedDB при старте.
   */
  async function restoreVirtualTracks(): Promise<void> {
    const saved = await virtualTracksService.loadAll()

    for (const track of Object.values(saved)) {
      if (!tracks.value[track.id]) {
        tracks.value[track.id] = track
        virtualTracks.value[track.id] = track

        // Восстанавливаем альбомы
        if (track.albumId && track.album) {
          const existingAlbum = albums.value[track.albumId]

          if (!existingAlbum) {
            albums.value[track.albumId] = {
              id: track.albumId,
              name: track.album,
              artist: track.artist,
              coverUrl: track.raw?.coverUrl,
              trackIds: [track.id],
            }
          } else {
            if (!existingAlbum.trackIds.includes(track.id)) {
              existingAlbum.trackIds.push(track.id)
            }
            if (!existingAlbum.coverUrl && track.raw?.coverUrl) {
              existingAlbum.coverUrl = track.raw.coverUrl
            }
          }
        }
      }
    }
  }

  function setCurrentFolder(folderId: string): void {
    if (!folders.value[folderId]) {
      console.warn(`[library] folder ${folderId} not found`)
      return
    }
    currentFolderId.value = folderId
  }

  function isSubtreeScanned(folderId: string): boolean {
    const cached = subtreeCache.get(folderId)
    if (cached !== undefined) return cached
    const result = isSubtreeScannedPure(folderId, (id) => folders.value[id] ?? null)
    subtreeCache.set(folderId, result)
    return result
  }

  function getAllTracksInFolderRecursive(folderId: string): LibraryTrack[] {
    const folder = folders.value[folderId]
    if (!folder) return []

    const result: LibraryTrack[] = []
    const visited = new Set<string>()
    const seenTracks = new Set<string>()

    const walk = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const f = folders.value[id]
      if (!f) return

      for (const trackId of f.trackIds) {
        if (seenTracks.has(trackId)) continue
        seenTracks.add(trackId)
        const track = tracks.value[trackId]
        if (track) result.push(track)
      }
      for (const childId of f.childFolderIds) {
        walk(childId)
      }
    }

    walk(folderId)
    return result
  }

  function clear(): void {
    for (const track of Object.values(tracks.value)) {
      if (track.raw?.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.raw.coverUrl)
      }
    }

    folders.value = {}
    tracks.value = {}
    albums.value = {}
    virtualTracks.value = {}
    currentFolderId.value = null
    clearSubtreeCache()
    void virtualTracksService.clear()
  }

  function getTrack(id: string): LibraryTrack | null {
    return tracks.value[id] ?? null
  }

  function getFolder(id: string): Folder | null {
    return folders.value[id] ?? null
  }

  function getAlbum(id: string): Album | null {
    return albums.value[id] ?? null
  }

  function updateTrackMetadata(
    trackId: string,
    patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'metaSource' | 'hasId3Tags'>>,
  ): void {
    const track = tracks.value[trackId]
    if (!track) return
    tracks.value[trackId] = { ...track, ...patch }

    if (track.isVirtual) {
      virtualTracks.value[trackId] = tracks.value[trackId]
      void virtualTracksService.saveAll(virtualTracks.value)
    }

    if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
  }

  return {
    folders,
    tracks,
    albums,
    virtualTracks,
    currentFolderId,

    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,

    resolveOrCreateTrack,
    removeVirtualTrack,
    restoreVirtualTracks,
    setCurrentFolder,
    isSubtreeScanned,
    getAllTracksInFolderRecursive,
    clear,
    getTrack,
    getFolder,
    getAlbum,
    updateTrackMetadata,
  }
})
