// src/stores/library/store.ts

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Folder, LibraryTrack } from '@/types/library'
import { sortService } from '@/services/sort/SortService'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { isSubtreeScanned as isSubtreeScannedPure } from '@/services/library/selectors'
import { subtreeCache, clearSubtreeCache } from './subtreeCache'

export const useLibraryStore = defineStore('library', () => {
  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})
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
      if (track.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.coverUrl)
      }
    }

    folders.value = {}
    tracks.value = {}
    currentFolderId.value = null
    clearSubtreeCache()
  }

  function getTrack(id: string): LibraryTrack | null {
    return tracks.value[id] ?? null
  }

  function getFolder(id: string): Folder | null {
    return folders.value[id] ?? null
  }

  function updateTrackMetadata(
    trackId: string,
    patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>>,
  ): void {
    const track = tracks.value[trackId]
    if (!track) return
    tracks.value[trackId] = { ...track, ...patch }
    if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
  }

  return {
    folders,
    tracks,
    currentFolderId,

    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,

    setCurrentFolder,
    isSubtreeScanned,
    getAllTracksInFolderRecursive,
    clear,
    getTrack,
    getFolder,
    updateTrackMetadata,
  }
})
