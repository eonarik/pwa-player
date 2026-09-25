// src/stores/library.ts

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { libraryPersistenceService } from '@/services/persistence/LibraryPersistenceService'
import type {
  PersistedLibrary,
  PersistedFolder,
  PersistedTrack,
} from '@/services/persistence/libraryTypes'
import type { Folder, LibraryTrack } from '@/types/library'

export const useLibraryStore = defineStore('library', () => {
  // --- Состояние ------------------------------------------------------

  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})
  const rootFolderId = ref<string | null>(null)
  const rootFolderName = ref<string | null>(null)

  /** Текущая папка, в которой находится пользователь (зеркало URL) */
  const currentFolderId = ref<string | null>(null)

  /** Флаг загрузки — пока идёт сканирование */
  const isLoading = ref(false)
  const loadProgress = ref({ folders: 0, tracks: 0 })

  /** Флаг восстановления — пока читаем из IDB */
  const isRestoring = ref(false)

  /** Нужно ли запросить права — выставляется, если restore упёрся в permission */
  const needsPermission = ref(false)

  // --- Computed -------------------------------------------------------

  const hasLibrary = computed(() => rootFolderId.value !== null)

  const currentFolder = computed<Folder | null>(() => {
    if (!currentFolderId.value) return null
    return folders.value[currentFolderId.value] ?? null
  })

  const currentSubfolders = computed<Folder[]>(() => {
    const folder = currentFolder.value
    if (!folder) return []
    return folder.childFolderIds
      .map((id) => folders.value[id])
      .filter((f): f is Folder => Boolean(f))
  })

  const currentTracks = computed<LibraryTrack[]>(() => {
    const folder = currentFolder.value
    if (!folder) return []
    return folder.trackIds
      .map((id) => tracks.value[id])
      .filter((t): t is LibraryTrack => Boolean(t))
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

  // --- Сериализация ---------------------------------------------------

  /**
   * Сериализация библиотеки в plain-объект для IDB.
   *
   * ВАЖНО: используем toRaw, потому что folders.value — это deep reactive proxy.
   * FileSystemHandle внутри proxy нельзя склонировать через structuredClone,
   * и IDB выбросит DataCloneError.
   */
  function toPersistedLibrary(): PersistedLibrary {
    const persistedFolders: PersistedFolder[] = Object.values(folders.value).map((folder) => {
      const raw = toRaw(folder)
      return {
        id: raw.id,
        name: raw.name,
        parentId: raw.parentId,
        path: raw.path,
        handle: toRaw(raw.handle),
        childFolderIds: [...raw.childFolderIds],
        trackIds: [...raw.trackIds],
        totalTrackCount: raw.totalTrackCount,
      }
    })

    const persistedTracks: PersistedTrack[] = Object.values(tracks.value).map((track) => {
      const raw = toRaw(track)
      return {
        id: raw.id,
        folderId: raw.folderId,
        title: raw.title,
        artist: raw.artist,
        album: raw.album,
        year: raw.year,
        trackNumber: raw.trackNumber,
        genre: raw.genre,
        duration: raw.duration,
        codec: raw.codec,
        filename: raw.filename,
        path: raw.path!,
        handle: toRaw(raw.handle),
      }
    })

    return {
      folders: persistedFolders,
      tracks: persistedTracks,
      rootFolderId: rootFolderId.value ?? '',
      rootFolderName: rootFolderName.value ?? '',
      savedAt: Date.now(),
    }
  }

  // --- Сохранение -----------------------------------------------------

  async function save(): Promise<void> {
    if (!hasLibrary.value) return
    await libraryPersistenceService.save(toPersistedLibrary())
  }

  // --- Восстановление -------------------------------------------------

  /**
   * Восстанавливает библиотеку из IDB.
   * Пересоздаёт File-объекты через handle.getFile().
   * Возвращает true, если что-то восстановлено.
   */
  async function restore(): Promise<boolean> {
    isRestoring.value = true
    try {
      const persisted = await libraryPersistenceService.load()
      if (!persisted || persisted.folders.length === 0) return false

      // Пересобираем папки
      const newFolders: Record<string, Folder> = {}
      for (const f of persisted.folders) {
        newFolders[f.id] = {
          id: f.id,
          name: f.name,
          parentId: f.parentId,
          path: f.path,
          handle: f.handle,
          childFolderIds: [...f.childFolderIds],
          trackIds: [...f.trackIds],
          totalTrackCount: f.totalTrackCount,
        }
      }

      // Пересобираем треки
      const newTracks: Record<string, LibraryTrack> = {}
      const failedTrackIds: string[] = []

      await Promise.all(
        persisted.tracks.map(async (t) => {
          try {
            const file = await t.handle.getFile()
            const folder = newFolders[t.folderId]
            newTracks[t.id] = {
              id: t.id,
              folderId: t.folderId,
              title: t.title,
              artist: t.artist,
              album: t.album,
              year: t.year,
              trackNumber: t.trackNumber,
              genre: t.genre,
              duration: t.duration,
              codec: t.codec,
              filename: t.filename,
              path: t.path,
              handle: t.handle,
              directoryHandle: folder?.handle,
              source: file,
            }
          } catch (err) {
            console.warn(`[library] can't restore file for "${t.title}"`, err)
            failedTrackIds.push(t.id)
          }
        }),
      )

      // Все треки битые → вероятно, потеряны права
      if (persisted.tracks.length > 0 && Object.keys(newTracks).length === 0) {
        console.warn('[library] all tracks failed to restore — likely permission lost')
        needsPermission.value = true
        return false
      }

      // Убираем битые из folder.trackIds
      if (failedTrackIds.length > 0) {
        const failedSet = new Set(failedTrackIds)
        for (const folder of Object.values(newFolders)) {
          folder.trackIds = folder.trackIds.filter((id) => !failedSet.has(id))
        }
      }

      // --- Восстанавливаем обложки: одна обложка на папку ---
      await restoreCovers(newFolders, newTracks)

      folders.value = newFolders
      tracks.value = newTracks
      rootFolderId.value = persisted.rootFolderId
      rootFolderName.value = persisted.rootFolderName
      needsPermission.value = false

      return true
    } finally {
      isRestoring.value = false
    }
  }

  /**
   * Ищет обложку для каждой папки и назначает её всем трекам папки.
   * Параллельно, с ограничением — findCoverInDirectory делает обход директории.
   */
  async function restoreCovers(
    newFolders: Record<string, Folder>,
    newTracks: Record<string, LibraryTrack>,
  ): Promise<void> {
    const foldersWithTracks = Object.values(newFolders).filter((f) => f.trackIds.length > 0)
    if (foldersWithTracks.length === 0) return

    const COVER_CONCURRENCY = 6
    let cursor = 0

    const worker = async (): Promise<void> => {
      while (cursor < foldersWithTracks.length) {
        const folder = foldersWithTracks[cursor++]!
        try {
          const coverFile = await fileSystemService.findCoverInDirectory(folder.handle)
          if (!coverFile) continue

          const coverUrl = URL.createObjectURL(coverFile)
          for (const trackId of folder.trackIds) {
            const track = newTracks[trackId]
            if (track) track.coverUrl = coverUrl
          }
        } catch (err) {
          console.warn(`[library] can't restore cover for folder "${folder.name}"`, err)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(COVER_CONCURRENCY, foldersWithTracks.length) }, () => worker()),
    )
  }

  /**
   * Повторная попытка восстановления после запроса прав.
   * Вызывать из UI по клику — тогда будет user gesture, и requestPermission сработает.
   */
  async function retryRestoreAfterPermission(): Promise<boolean> {
    const persisted = await libraryPersistenceService.load()
    if (!persisted) return false

    const rootFolder = persisted.folders.find((f) => f.id === persisted.rootFolderId)
    if (!rootFolder) return false

    const granted = await fileSystemService.verifyPermission(rootFolder.handle, 'read')
    if (!granted) return false

    return restore()
  }

  // --- Actions --------------------------------------------------------

  async function loadFromHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    isLoading.value = true
    loadProgress.value = { folders: 0, tracks: 0 }

    try {
      const collected = await fileSystemService.collectLibrary(handle, (f, t) => {
        loadProgress.value = { folders: f, tracks: t }
      })

      const newFolders: Record<string, Folder> = {}
      for (const folder of collected.folders) {
        newFolders[folder.id] = folder
      }

      const newTracks: Record<string, LibraryTrack> = {}
      for (const track of collected.tracks) {
        newTracks[track.id] = track
      }

      folders.value = newFolders
      tracks.value = newTracks
      rootFolderId.value = collected.rootFolderId
      rootFolderName.value = collected.rootFolderName
      currentFolderId.value = collected.rootFolderId
      needsPermission.value = false

      await save()
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Обновляет currentFolderId. Вызывается из FolderRoute при синхронизации URL → стор.
   * НЕ пушит URL — это делает компонент.
   */
  function setCurrentFolder(folderId: string): void {
    if (!folders.value[folderId]) {
      console.warn(`[library] folder ${folderId} not found`)
      return
    }
    currentFolderId.value = folderId
  }

  function clear(): void {
    for (const track of Object.values(tracks.value)) {
      if (track.coverUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(track.coverUrl)
      }
    }

    folders.value = {}
    tracks.value = {}
    rootFolderId.value = null
    rootFolderName.value = null
    currentFolderId.value = null
    needsPermission.value = false

    void libraryPersistenceService.clear()
  }

  // --- Вспомогательные ------------------------------------------------

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
    rootFolderId,
    rootFolderName,
    currentFolderId,
    isLoading,
    isRestoring,
    needsPermission,
    loadProgress,

    // computed
    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,

    // actions
    loadFromHandle,
    setCurrentFolder,
    clear,
    save,
    restore,
    retryRestoreAfterPermission,
    getTrack,
    getFolder,
  }
})
