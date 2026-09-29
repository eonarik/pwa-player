// src/stores/library.ts

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { coverService } from '@/services/covers/CoverService'
import type { CollectedLibrary, Folder, LibraryTrack, TrackOrigin } from '@/types/library'
import { sortBy, trackSortKey } from '@/utils/sort'
import type { LibraryWriter } from '@/plugins/types'
import { librarySaveService } from '@/services/library/LibrarySaveService'

/** Сколько обложек ищем параллельно */
const COVER_CONCURRENCY = 3

export const useLibraryStore = defineStore('library', () => {
  // --- Состояние ------------------------------------------------------

  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})

  /** Что открыто сейчас. null = главная (список плагинов) */
  const currentFolderId = ref<string | null>(null)

  /** Версия обложек — триггер для пересчёта coverStats */
  const coversVersion = ref(0)

  const isLoadingCovers = ref(false)
  const coverProgress = ref({ done: 0, total: 0 })

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
    return sortBy(list, (f) => f.name)
  })

  const currentTracks = computed<LibraryTrack[]>(() => {
    const folder = currentFolder.value
    if (!folder) return []
    const list = folder.trackIds
      .map((id) => tracks.value[id])
      .filter((t): t is LibraryTrack => Boolean(t))
    return sortBy(list, trackSortKey)
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

  const tracksWithoutCovers = computed(() => {
    return currentTracks.value.filter((t) => !t.coverUrl).length
  })

  const coverStats = computed(() => {
    void coversVersion.value

    let checked = 0
    let found = 0

    for (const track of currentTracks.value) {
      const cached = coverPersistenceService.get(track.id)
      if (cached === undefined) continue
      checked++
      if (cached !== null) found++
    }

    return {
      total: checked,
      checked,
      found,
    }
  })

  // --- Вспомогательные ------------------------------------------------

  function bumpCoversVersion(): void {
    coversVersion.value++
  }

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

  async function fetchCoversForCurrentFolder(): Promise<void> {
    const folder = currentFolder.value
    if (!folder) return

    const tracksToFetch = currentTracks.value.filter((t) => !t.coverUrl)
    if (tracksToFetch.length === 0) return

    const toFetch: LibraryTrack[] = []
    for (const track of tracksToFetch) {
      const cached = coverPersistenceService.get(track.id)
      if (cached !== undefined) {
        if (cached !== null) {
          const existing = tracks.value[track.id]
          if (existing) existing.coverUrl = cached
        }
        continue
      }
      toFetch.push(track)
    }

    if (toFetch.length === 0) {
      bumpCoversVersion()
      return
    }

    isLoadingCovers.value = true
    coverProgress.value = { done: 0, total: toFetch.length }

    try {
      const results: Array<{ trackId: string; coverUrl: string | null }> = []
      let cursor = 0

      const worker = async (): Promise<void> => {
        while (cursor < toFetch.length) {
          const track = toFetch[cursor++]!
          const coverUrl = await coverService.fetch(track.artist, track.title)

          results.push({ trackId: track.id, coverUrl })

          if (coverUrl) {
            const existing = tracks.value[track.id]
            if (existing) existing.coverUrl = coverUrl
          }

          coverProgress.value = {
            done: coverProgress.value.done + 1,
            total: toFetch.length,
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(COVER_CONCURRENCY, toFetch.length) }, () => worker()),
      )

      await coverPersistenceService.setMany(results)
      bumpCoversVersion()
    } finally {
      isLoadingCovers.value = false
      coverProgress.value = { done: 0, total: 0 }
    }
  }

  async function resetCoversForCurrentFolder(): Promise<void> {
    const folder = currentFolder.value
    if (!folder) return

    const trackIds = currentTracks.value.filter((t) => !t.coverUrl).map((t) => t.id)
    if (trackIds.length === 0) return

    await coverPersistenceService.resetNotFound(trackIds)
    bumpCoversVersion()
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

  return {
    // state
    folders,
    tracks,
    currentFolderId,

    isLoadingCovers,
    coverProgress,

    // computed
    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,
    tracksWithoutCovers,
    coverStats,

    // actions
    setCurrentFolder,
    getAllTracksInFolderRecursive,
    fetchCoversForCurrentFolder,
    resetCoversForCurrentFolder,
    clear,
    getTrack,
    getFolder,
  }
})

// --- LibraryWriter для плагинов --------------------------------------

/**
 * Фабрика LibraryWriter.
 *
 * Вызывается из `createPluginContext` в `src/plugins/context.ts`.
 * Плагин не импортирует library.ts напрямую — только получает writer
 * через PluginContext.
 *
 * `setLibrary` заменяет папки и треки ТОЛЬКО указанного sourceId.
 * Чужие плагины не трогаются.
 */
export function createLibraryWriter(): LibraryWriter {
  function store() {
    return useLibraryStore()
  }

  return {
    setLibrary(collected: CollectedLibrary, sourceId: string): void {
      const s = store()

      // Удаляем старые папки и треки этого плагина
      for (const [id, folder] of Object.entries(s.folders)) {
        if (folder.source === sourceId) delete s.folders[id]
      }
      for (const [id, track] of Object.entries(s.tracks)) {
        if (track.pluginId === sourceId) {
          if (track.coverUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(track.coverUrl)
          }
          delete s.tracks[id]
        }
      }

      // Добавляем новые
      for (const folder of collected.folders) {
        s.folders[folder.id] = { ...folder, source: sourceId }
      }
      for (const track of collected.tracks) {
        s.tracks[track.id] = { ...track, pluginId: sourceId }
      }
    },

    removeFolders(folderIds: string[]): void {
      const s = store()
      for (const id of folderIds) {
        delete s.folders[id]
      }
    },

    removeBySource(sourceId: string): void {
      const s = store()
      for (const [id, folder] of Object.entries(s.folders)) {
        if (folder.source === sourceId) delete s.folders[id]
      }
      for (const [id, track] of Object.entries(s.tracks)) {
        if (track.pluginId === sourceId) {
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

    addTracks(tracks: LibraryTrack[], sourceId: string): void {
      const s = store()
      const affectedFolders = new Set<string>()

      for (const track of tracks) {
        s.tracks[track.id] = { ...track, pluginId: sourceId }
        if (track.folderId) affectedFolders.add(track.folderId)
      }

      // Добавляем trackId в folder.trackIds
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

    removeTracks(trackIds: string[]): void {
      const s = store()
      const pluginIds = new Set<string>()
      for (const id of trackIds) {
        const track = s.tracks[id]
        if (track?.coverUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(track.coverUrl)
        }
        if (track?.pluginId) pluginIds.add(track.pluginId)
        delete s.tracks[id]
      }
      for (const pluginId of pluginIds) {
        librarySaveService.scheduleSave(pluginId)
      }
    },

    addFolders(folders: Folder[], sourceId: string): void {
      const s = store()
      for (const folder of folders) {
        s.folders[folder.id] = { ...folder, source: sourceId }
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
      return Object.values(store().folders).filter((f) => f.source === sourceId)
    },

    getTracksBySource(sourceId: string): LibraryTrack[] {
      return Object.values(store().tracks).filter((t) => t.pluginId === sourceId)
    },

    getCurrentFolderId(): string | null {
      return store().currentFolderId
    },

    setCurrentFolder(folderId: string): void {
      store().currentFolderId = folderId
    },
  }
}
