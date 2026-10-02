// src/stores/library.ts

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CollectedLibrary, Folder, LibraryTrack, TrackOrigin } from '@/types/library'
import type { LibraryWriter } from '@/plugins/types'
import { librarySaveService } from '@/services/library/LibrarySaveService'
import { sortService } from '@/services/sort/SortService'

export const useLibraryStore = defineStore('library', () => {
  // --- Состояние ------------------------------------------------------

  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})

  const currentFolderId = ref<string | null>(null)

  // --- Computed -------------------------------------------------------

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
    const list = folder.trackIds
      .map((id) => tracks.value[id])
      .filter((t): t is LibraryTrack => Boolean(t))
    return sortService.sort(list)
  })

  const breadcrumbs = computed<Folder[]>(() => {
    const crumbs: Folder[] = []
    let folder = currentFolder.value
    while (folder) {
      crumbs.unshift(folder)
      folder = folder.parentId ? (folders.value[folder.parentId] ?? null) : null
    }
    return crumbs
  })

  const canGoUp = computed(() => {
    const folder = currentFolder.value
    return Boolean(folder && folder.parentId)
  })

  // --- Общие операции -------------------------------------------------

  function setCurrentFolder(folderId: string): void {
    if (!folders.value[folderId]) {
      console.warn(`[library] folder ${folderId} not found`)
      return
    }
    currentFolderId.value = folderId
  }

  function getAllTracksInFolderRecursive(folderId: string): LibraryTrack[] {
    const folder = folders.value[folderId]
    if (!folder) return []

    const result: LibraryTrack[] = []

    for (const trackId of folder.trackIds) {
      const track = tracks.value[trackId]
      if (track) result.push(track)
    }

    for (const childId of folder.childFolderIds) {
      result.push(...getAllTracksInFolderRecursive(childId))
    }

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
    getAllTracksInFolderRecursive,
    clear,
    getTrack,
    getFolder,
    updateTrackMetadata,
  }
})

// --- LibraryWriter для плагинов --------------------------------------

export function createLibraryWriter(): LibraryWriter {
  function store() {
    return useLibraryStore()
  }

  function matchesSource(source: string | undefined, sourceId: string): boolean {
    if (!source) return false
    return source === sourceId || source.startsWith(sourceId + ':')
  }

  /**
   * Пересчитывает totalTrackCount / totalTextFileCount для папки
   * на основе её собственных треков/файлов и счётчиков детей.
   *
   * Затем поднимается к родителю (рекурсивно).
   * `processed` защищает от повторного обхода одной ветки.
   */
  function recalcAncestors(folderId: string, processed: Set<string>): void {
    const s = store()
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

    if (folder.parentId && !processed.has(folder.parentId)) {
      processed.add(folderId)
      recalcAncestors(folder.parentId, processed)
    }
  }

  return {
    setLibrary(collected: CollectedLibrary, sourceId: string): void {
      const s = store()

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
        s.folders[folder.id] = { ...folder, source: folder.source ?? sourceId }
      }
      for (const track of collected.tracks) {
        s.tracks[track.id] = { ...track, pluginId: track.pluginId ?? sourceId }
      }
    },

    /**
     * Удаляет папки (рекурсивно — вместе со всеми подпапками и треками).
     * Также:
     * - revoke'ит blob URL всех удалённых треков,
     * - убирает удалённые папки из childFolderIds их родителей,
     * - пересчитывает totalTrackCount / totalTextFileCount вверх по дереву.
     */
    removeFolders(folderIds: string[]): void {
      const s = store()

      // 1. Собираем всё поддерево + связанные треки + родителей
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

      // 2. Удаляем треки + revoke blob URL
      const pluginIds = new Set<string>()
      for (const trackId of allTrackIds) {
        const track = s.tracks[trackId]
        if (track?.coverUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(track.coverUrl)
        }
        if (track?.pluginId) pluginIds.add(track.pluginId)
        delete s.tracks[trackId]
      }

      // 3. Удаляем папки
      for (const id of allFolderIds) {
        const folder = s.folders[id]
        if (folder?.source) pluginIds.add(folder.source)
        delete s.folders[id]
      }

      // 4. Убираем удалённые папки из childFolderIds родителей
      for (const parentId of parentIds) {
        const parent = s.folders[parentId]
        if (!parent) continue
        s.folders[parentId] = {
          ...parent,
          childFolderIds: parent.childFolderIds.filter((id) => !allFolderIds.has(id)),
        }
      }

      // 5. Пересчитываем счётчики вверх
      const processed = new Set<string>()
      for (const parentId of parentIds) {
        recalcAncestors(parentId, processed)
      }

      // 6. Сохраняем затронутые плагины
      for (const pluginId of pluginIds) {
        librarySaveService.scheduleSave(pluginId)
      }
    },

    removeBySource(sourceId: string): void {
      const s = store()
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
    },

    updateTrackOrigin(trackId: string, origin: TrackOrigin): void {
      const s = store()
      const track = s.tracks[trackId]
      if (!track) return
      s.tracks[trackId] = { ...track, origin }
      if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
    },

    updateTrackSource(trackId: string, source: string | File): void {
      const s = store()
      const track = s.tracks[trackId]
      if (!track) return
      s.tracks[trackId] = { ...track, source }
      if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
    },

    updateTrackDuration(trackId: string, duration: number): void {
      const s = store()
      const track = s.tracks[trackId]
      if (!track) return
      if (track.duration === duration) return
      s.tracks[trackId] = { ...track, duration }
      if (track.pluginId) librarySaveService.scheduleSave(track.pluginId)
    },

    updateTrackMetadata(
      trackId: string,
      patch: Partial<Pick<LibraryTrack, 'artist' | 'title' | 'album' | 'coverUrl'>>,
    ): void {
      store().updateTrackMetadata(trackId, patch)
    },

    addTracks(tracks: LibraryTrack[], sourceId: string): void {
      const s = store()
      const affectedFolders = new Set<string>()

      for (const track of tracks) {
        s.tracks[track.id] = { ...track, pluginId: sourceId }
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

      librarySaveService.scheduleSave(sourceId)
    },

    /**
     * Удаляет треки (по id), не трогая папки.
     * Также:
     * - revoke'ит blob URL,
     * - убирает trackId из folder.trackIds,
     * - пересчитывает totalTrackCount вверх по дереву.
     */
    removeTracks(trackIds: string[]): void {
      const s = store()

      const idsSet = new Set(trackIds)
      const affectedFolderIds = new Set<string>()
      const pluginIds = new Set<string>()

      // 1. Удаляем треки + revoke + собираем папки
      for (const id of trackIds) {
        const track = s.tracks[id]
        if (!track) continue
        if (track.coverUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(track.coverUrl)
        }
        if (track.folderId) affectedFolderIds.add(track.folderId)
        if (track.pluginId) pluginIds.add(track.pluginId)
        delete s.tracks[id]
      }

      // 2. Убираем trackId из folder.trackIds
      for (const folderId of affectedFolderIds) {
        const folder = s.folders[folderId]
        if (!folder) continue
        s.folders[folderId] = {
          ...folder,
          trackIds: folder.trackIds.filter((id) => !idsSet.has(id)),
        }
      }

      // 3. Пересчитываем счётчики вверх по дереву
      const processed = new Set<string>()
      for (const folderId of affectedFolderIds) {
        recalcAncestors(folderId, processed)
      }

      // 4. Сохраняем затронутые плагины
      for (const pluginId of pluginIds) {
        librarySaveService.scheduleSave(pluginId)
      }
    },

    addFolders(folders: Folder[], sourceId: string): void {
      const s = store()
      for (const folder of folders) {
        s.folders[folder.id] = { ...folder, source: folder.source ?? sourceId }
      }
      librarySaveService.scheduleSave(sourceId)
    },

    updateFolder(folderId: string, patch: Partial<Folder>): void {
      const s = store()
      const existing = s.folders[folderId]
      if (!existing) return
      s.folders[folderId] = { ...existing, ...patch }
      if (existing.source) librarySaveService.scheduleSave(existing.source)
    },

    getFolder(folderId: string): Folder | null {
      return store().folders[folderId] ?? null
    },

    getTrack(trackId: string): LibraryTrack | null {
      return store().tracks[trackId] ?? null
    },

    getFoldersBySource(sourceId: string): Folder[] {
      return Object.values(store().folders).filter((f) => matchesSource(f.source, sourceId))
    },

    getTracksBySource(sourceId: string): LibraryTrack[] {
      return Object.values(store().tracks).filter((t) => matchesSource(t.pluginId, sourceId))
    },

    getCurrentFolderId(): string | null {
      return store().currentFolderId
    },

    setCurrentFolder(folderId: string): void {
      store().currentFolderId = folderId
    },
  }
}
