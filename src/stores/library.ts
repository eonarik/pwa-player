// src/stores/library.ts

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { libraryPersistenceService } from '@/services/persistence/LibraryPersistenceService'
import { yandexLibraryPersistenceService } from '@/services/persistence/YandexLibraryPersistenceService'
import { yandexDiskService } from '@/services/yandex/YandexDiskService'
import { mapWithConcurrency } from '@/services/yandex/concurrency'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import type {
  PersistedLibrary,
  PersistedFolder,
  PersistedTrack,
} from '@/services/persistence/libraryTypes'
import type {
  PersistedYandexFolder,
  PersistedYandexTrack,
  PersistedYandexLibrary,
} from '@/services/persistence/yandexTypes'
import type { Folder, LibraryTrack } from '@/types/library'
import { saveLastSource } from '@/services/persistence/lastSource'

/** Сколько папок на Диске обходим параллельно */
const YANDEX_CONCURRENCY = 5

export const useLibraryStore = defineStore('library', () => {
  // --- Состояние ------------------------------------------------------

  const folders = ref<Record<string, Folder>>({})
  const tracks = ref<Record<string, LibraryTrack>>({})
  const rootFolderId = ref<string | null>(null)
  const rootFolderName = ref<string | null>(null)

  const currentFolderId = ref<string | null>(null)

  const source = ref<'local' | 'yandex' | null>(null)

  const isLoading = ref(false)
  const loadProgress = ref({ folders: 0, tracks: 0 })

  const isRestoring = ref(false)
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

  // --- Сериализация локальной библиотеки ------------------------------

  function toPersistedLibrary(): PersistedLibrary | null {
    if (source.value !== 'local') return null

    const persistedFolders: PersistedFolder[] = []
    for (const folder of Object.values(folders.value)) {
      if (!folder.handle) continue
      const raw = toRaw(folder)
      persistedFolders.push({
        id: raw.id,
        name: raw.name,
        parentId: raw.parentId,
        path: raw.path,
        handle: toRaw(raw.handle!),
        childFolderIds: [...raw.childFolderIds],
        trackIds: [...raw.trackIds],
        totalTrackCount: raw.totalTrackCount,
      })
    }

    const persistedTracks: PersistedTrack[] = []
    for (const track of Object.values(tracks.value)) {
      if (!track.handle) continue
      const raw = toRaw(track)
      persistedTracks.push({
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
        handle: toRaw(raw.handle!),
      })
    }

    return {
      folders: persistedFolders,
      tracks: persistedTracks,
      rootFolderId: rootFolderId.value ?? '',
      rootFolderName: rootFolderName.value ?? '',
      savedAt: Date.now(),
    }
  }

  async function save(): Promise<void> {
    if (!hasLibrary.value) return
    const persisted = toPersistedLibrary()
    if (!persisted) return
    await libraryPersistenceService.save(persisted)
  }

  // --- Восстановление локальной библиотеки ----------------------------

  async function restore(): Promise<boolean> {
    isRestoring.value = true
    try {
      const persisted = await libraryPersistenceService.load()
      if (!persisted || persisted.folders.length === 0) return false

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
          source: 'local',
        }
      }

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

      if (persisted.tracks.length > 0 && Object.keys(newTracks).length === 0) {
        console.warn('[library] all tracks failed to restore — likely permission lost')
        needsPermission.value = true
        return false
      }

      if (failedTrackIds.length > 0) {
        const failedSet = new Set(failedTrackIds)
        for (const folder of Object.values(newFolders)) {
          folder.trackIds = folder.trackIds.filter((id) => !failedSet.has(id))
        }
      }

      await restoreCovers(newFolders, newTracks)

      folders.value = newFolders
      tracks.value = newTracks
      rootFolderId.value = persisted.rootFolderId
      rootFolderName.value = persisted.rootFolderName
      source.value = 'local'
      needsPermission.value = false

      return true
    } finally {
      isRestoring.value = false
    }
  }

  async function restoreCovers(
    newFolders: Record<string, Folder>,
    newTracks: Record<string, LibraryTrack>,
  ): Promise<void> {
    const foldersWithTracks = Object.values(newFolders).filter(
      (f) => f.trackIds.length > 0 && f.handle,
    )
    if (foldersWithTracks.length === 0) return

    const COVER_CONCURRENCY = 6
    let cursor = 0

    const worker = async (): Promise<void> => {
      while (cursor < foldersWithTracks.length) {
        const folder = foldersWithTracks[cursor++]!
        if (!folder.handle) continue
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

  async function retryRestoreAfterPermission(): Promise<boolean> {
    const persisted = await libraryPersistenceService.load()
    if (!persisted) return false

    const rootFolder = persisted.folders.find((f) => f.id === persisted.rootFolderId)
    if (!rootFolder) return false

    const granted = await fileSystemService.verifyPermission(rootFolder.handle, 'read')
    if (!granted) return false

    return restore()
  }

  // --- Локальная загрузка ---------------------------------------------

  async function loadFromHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    isLoading.value = true
    loadProgress.value = { folders: 0, tracks: 0 }

    try {
      const collected = await fileSystemService.collectLibrary(handle, (f, t) => {
        loadProgress.value = { folders: f, tracks: t }
      })

      const newFolders: Record<string, Folder> = {}
      for (const folder of collected.folders) {
        newFolders[folder.id] = { ...folder, source: 'local' }
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
      source.value = 'local'
      needsPermission.value = false

      await save()
      await saveLastSource('local')
    } finally {
      isLoading.value = false
    }
  }

  // --- Яндекс.Диск ----------------------------------------------------

  /**
   * Загружает библиотеку из Яндекс.Диска.
   * Если есть свежий кэш и forceRefresh=false — восстанавливает из него.
   */
  async function loadFromYandexDisk(
    rootPath: string,
    options: { forceRefresh?: boolean } = {},
  ): Promise<void> {
    const { forceRefresh = false } = options

    // --- 1. Пробуем кэш ---
    if (!forceRefresh) {
      const cached = await yandexLibraryPersistenceService.load()
      if (cached && yandexLibraryPersistenceService.isFresh(cached)) {
        console.info('[library] using cached Yandex.Disk library')
        restoreFromYandexCache(cached)
        return
      }
    }

    // --- 2. Сканируем заново ---
    isLoading.value = true
    loadProgress.value = { folders: 0, tracks: 0 }

    try {
      const newFolders: Record<string, Folder> = {}
      const newTracks: Record<string, LibraryTrack> = {}

      const normalizedPath = rootPath.startsWith('disk:') ? rootPath : `disk:${rootPath}`
      const rootId = folderIdFromPath(`yandex:${normalizedPath}`)

      const updateProgress = (): void => {
        loadProgress.value = {
          folders: Object.keys(newFolders).length,
          tracks: Object.keys(newTracks).length,
        }
      }

      const walk = async (
        remotePath: string,
        folderId: string,
        parentId: string | null,
        pathPrefix: string,
      ): Promise<Folder> => {
        const response = await yandexDiskService.listResources(remotePath)

        const childFolderIds: string[] = []
        const trackIds: string[] = []
        const subDirs: typeof response.items = []

        for (const item of response.items) {
          if (item.type === 'dir') {
            subDirs.push(item)
          } else if (item.isAudio) {
            const trackPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
            const trackId = trackIdFromPath(`yandex:${item.path}`)
            newTracks[trackId] = {
              id: trackId,
              folderId,
              filename: item.name,
              path: trackPath,
              remotePath: item.path,
              source: yandexDiskService.buildDownloadUrl(item.path),
              title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
              artist: 'Yandex Disk',
              album: pathPrefix || 'Yandex Disk',
            }
            trackIds.push(trackId)
          }
        }

        updateProgress()

        const childFolders = await mapWithConcurrency(subDirs, YANDEX_CONCURRENCY, async (item) => {
          const childPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
          const childId = folderIdFromPath(`yandex:${item.path}`)
          const child = await walk(item.path, childId, folderId, childPath)
          newFolders[child.id] = child
          return child
        })

        for (const child of childFolders) {
          childFolderIds.push(child.id)
        }

        const childTotal = childFolders.reduce((sum, f) => sum + f.totalTrackCount, 0)

        return {
          id: folderId,
          name:
            remotePath === 'disk:/'
              ? 'Yandex Disk'
              : remotePath.split('/').filter(Boolean).pop() || 'Yandex Disk',
          parentId,
          path: pathPrefix,
          remotePath,
          childFolderIds,
          trackIds,
          totalTrackCount: trackIds.length + childTotal,
          source: 'yandex',
        }
      }

      const rootFolder = await walk(normalizedPath, rootId, null, '')
      newFolders[rootFolder.id] = rootFolder

      folders.value = newFolders
      tracks.value = newTracks
      rootFolderId.value = rootFolder.id
      rootFolderName.value = 'Yandex Disk'
      currentFolderId.value = rootFolder.id
      source.value = 'yandex'
      needsPermission.value = false

      // --- 3. Сохраняем в кэш ---
      await saveYandexCache(normalizedPath)
      await saveLastSource('yandex')
    } finally {
      isLoading.value = false
    }
  }

  /** Сохраняет текущую библиотеку Диска в IDB */
  async function saveYandexCache(rootPath: string): Promise<void> {
    if (source.value !== 'yandex' || !rootFolderId.value) return

    const persistedFolders: PersistedYandexFolder[] = Object.values(folders.value).map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      path: f.path,
      remotePath: f.remotePath ?? '',
      childFolderIds: [...f.childFolderIds],
      trackIds: [...f.trackIds],
      totalTrackCount: f.totalTrackCount,
    }))

    const persistedTracks: PersistedYandexTrack[] = []
    for (const t of Object.values(tracks.value)) {
      if (!t.remotePath) continue
      persistedTracks.push({
        id: t.id,
        folderId: t.folderId,
        filename: t.filename,
        path: t.path!,
        remotePath: t.remotePath,
        title: t.title,
        artist: t.artist,
        album: t.album,
      })
    }

    await yandexLibraryPersistenceService.save({
      folders: persistedFolders,
      tracks: persistedTracks,
      rootFolderId: rootFolderId.value,
      rootFolderName: rootFolderName.value ?? 'Yandex Disk',
      rootPath,
      savedAt: Date.now(),
    })
  }

  /**
   * Точечно обновляет содержимое текущей папки на Яндекс.Диске.
   * Не трогает подпапки вглубь — только треки и список дочерних папок.
   *
   * Логика:
   * - Запрашиваем `/resources?path=<folder.remotePath>`.
   * - Обновляем `folder.trackIds`, `folder.childFolderIds`.
   * - Новые треки добавляем в `tracks`, исчезнувшие — удаляем.
   * - Папки, которых нет в `folders`, создаём «пустыми» (загрузятся при заходе).
   * - Обновляем кэш.
   */
  async function refreshCurrentYandexFolder(): Promise<void> {
    if (source.value !== 'yandex') {
      console.warn('[library] refreshCurrentYandexFolder: not a Yandex library')
      return
    }

    const folder = currentFolder.value
    if (!folder || !folder.remotePath) {
      console.warn('[library] refreshCurrentYandexFolder: no remotePath on current folder')
      return
    }

    isLoading.value = true
    try {
      const response = await yandexDiskService.listResources(folder.remotePath)

      const newTrackIds: string[] = []
      const newChildFolderIds: string[] = []
      const subDirs: typeof response.items = []

      for (const item of response.items) {
        if (item.type === 'dir') {
          subDirs.push(item)
        } else if (item.isAudio) {
          const trackId = trackIdFromPath(`yandex:${item.path}`)
          const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name

          if (!tracks.value[trackId]) {
            tracks.value[trackId] = {
              id: trackId,
              folderId: folder.id,
              filename: item.name,
              path: trackPath,
              remotePath: item.path,
              source: yandexDiskService.buildDownloadUrl(item.path),
              title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
              artist: 'Yandex Disk',
              album: folder.path || 'Yandex Disk',
            }
          }
          newTrackIds.push(trackId)
        }
      }

      // Папки: обновляем только список id.
      // Существующие папки вглубь не трогаем — обновятся при заходе.
      for (const item of subDirs) {
        const childId = folderIdFromPath(`yandex:${item.path}`)
        const childPath = folder.path ? `${folder.path}/${item.name}` : item.name

        if (!folders.value[childId]) {
          folders.value[childId] = {
            id: childId,
            name: item.name,
            parentId: folder.id,
            path: childPath,
            remotePath: item.path,
            childFolderIds: [],
            trackIds: [],
            totalTrackCount: 0,
            source: 'yandex',
          }
        }
        newChildFolderIds.push(childId)
      }

      // Убираем треки, которых больше нет на Диске
      const removedTrackIds = folder.trackIds.filter((id) => !newTrackIds.includes(id))
      for (const id of removedTrackIds) {
        const t = tracks.value[id]
        if (t?.coverUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(t.coverUrl)
        }
        delete tracks.value[id]
      }

      // Убираем подпапки, которых больше нет
      const removedFolderIds = folder.childFolderIds.filter((id) => !newChildFolderIds.includes(id))
      for (const id of removedFolderIds) {
        delete folders.value[id]
      }

      // Обновляем папку
      folders.value[folder.id] = {
        ...folder,
        trackIds: newTrackIds,
        childFolderIds: newChildFolderIds,
      }

      // Обновляем кэш
      const root = rootFolder.value
      if (root?.remotePath) {
        await saveYandexCache(root.remotePath)
      }
    } finally {
      isLoading.value = false
    }
  }

  /** Восстанавливает библиотеку Диска из кэша */
  function restoreFromYandexCache(cached: PersistedYandexLibrary): void {
    const newFolders: Record<string, Folder> = {}
    for (const f of cached.folders) {
      newFolders[f.id] = {
        id: f.id,
        name: f.name,
        parentId: f.parentId,
        path: f.path,
        remotePath: f.remotePath,
        childFolderIds: [...f.childFolderIds],
        trackIds: [...f.trackIds],
        totalTrackCount: f.totalTrackCount,
        source: 'yandex',
      }
    }

    const newTracks: Record<string, LibraryTrack> = {}
    for (const t of cached.tracks) {
      newTracks[t.id] = {
        id: t.id,
        folderId: t.folderId,
        filename: t.filename,
        path: t.path,
        remotePath: t.remotePath,
        source: yandexDiskService.buildDownloadUrl(t.remotePath),
        title: t.title,
        artist: t.artist,
        album: t.album,
      }
    }

    folders.value = newFolders
    tracks.value = newTracks
    rootFolderId.value = cached.rootFolderId
    rootFolderName.value = cached.rootFolderName
    currentFolderId.value = cached.rootFolderId
    source.value = 'yandex'
    needsPermission.value = false

    void saveLastSource('yandex')
  }

  /**
   * Пробует восстановить библиотеку Яндекс.Диска из кэша.
   * Возвращает true, если удалось.
   */
  async function restoreYandexFromCache(): Promise<boolean> {
    const cached = await yandexLibraryPersistenceService.load()
    if (!cached || !yandexLibraryPersistenceService.isFresh(cached)) {
      return false
    }
    console.info('[library] auto-restoring Yandex.Disk library from cache')
    restoreFromYandexCache(cached)
    return true
  }

  // --- Общие операции -------------------------------------------------

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
    source.value = null
    needsPermission.value = false

    // Локальный кэш чистим, кэш Диска — оставляем
    void libraryPersistenceService.clear()
  }

  function getTrack(id: string): LibraryTrack | null {
    return tracks.value[id] ?? null
  }

  function getFolder(id: string): Folder | null {
    return folders.value[id] ?? null
  }

  return {
    folders,
    tracks,
    rootFolderId,
    rootFolderName,
    currentFolderId,
    source,
    isLoading,
    isRestoring,
    needsPermission,
    loadProgress,

    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,

    loadFromHandle,
    loadFromYandexDisk,
    restoreYandexFromCache,
    refreshCurrentYandexFolder,
    setCurrentFolder,
    clear,
    save,
    restore,
    retryRestoreAfterPermission,
    getTrack,
    getFolder,
  }
})
