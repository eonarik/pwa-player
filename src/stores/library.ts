// src/stores/library.ts

import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { fileSystemService } from '@/services/filesystem/FileSystemService'
import { libraryPersistenceService } from '@/services/persistence/LibraryPersistenceService'
import { yandexLibraryPersistenceService } from '@/services/persistence/YandexLibraryPersistenceService'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
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
import { sortBy, trackSortKey } from '@/utils/sort'

/** Сколько папок на Диске обходим параллельно */
const YANDEX_CONCURRENCY = 5
/** Сколько обложек ищем параллельно */
const COVER_CONCURRENCY = 3

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

  /** Отдельный флаг для загрузки обложек — не блокирует UI библиотеки */
  const isLoadingCovers = ref(false)
  const coverProgress = ref({ done: 0, total: 0 })

  /** Версия кэша обложек — инкрементируется при изменениях, чтобы триггерить computed */
  const coversVersion = ref(0)

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

  /** Сколько треков в текущей папке без обложки */
  const tracksWithoutCovers = computed(() => {
    return currentTracks.value.filter((t) => !t.coverUrl).length
  })

  /** Статистика по обложкам в текущей папке */
  const coverStats = computed(() => {
    void coversVersion.value

    let checked = 0
    let found = 0

    for (const track of currentTracks.value) {
      const cached = coverPersistenceService.get(track.id)
      if (cached === undefined) continue // не искали
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
            const cachedCover = coverPersistenceService.get(t.id)

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
              coverUrl: cachedCover ?? undefined,
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

      bumpCoversVersion()
      return true
    } finally {
      isRestoring.value = false
    }
  }

  /** Ищет обложку в папке (`folder.jpg`) и применяет её ко всем трекам папки */
  async function restoreCovers(
    newFolders: Record<string, Folder>,
    newTracks: Record<string, LibraryTrack>,
  ): Promise<void> {
    const foldersWithTracks = Object.values(newFolders).filter(
      (f) => f.trackIds.length > 0 && f.handle,
    )
    if (foldersWithTracks.length === 0) return

    const COVER_FOLDER_CONCURRENCY = 6
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
            if (track && !track.coverUrl) track.coverUrl = coverUrl
          }
        } catch (err) {
          console.warn(`[library] can't restore cover for folder "${folder.name}"`, err)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(COVER_FOLDER_CONCURRENCY, foldersWithTracks.length) }, () =>
        worker(),
      ),
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
        const cachedCover = coverPersistenceService.get(track.id)
        newTracks[track.id] = {
          ...track,
          coverUrl: track.coverUrl ?? cachedCover ?? undefined,
        }
      }

      folders.value = newFolders
      tracks.value = newTracks
      rootFolderId.value = collected.rootFolderId
      rootFolderName.value = collected.rootFolderName
      currentFolderId.value = collected.rootFolderId
      source.value = 'local'
      needsPermission.value = false

      bumpCoversVersion()

      await save()
      await saveLastSource('local')
    } finally {
      isLoading.value = false
    }
  }

  // --- Яндекс.Диск ----------------------------------------------------

  async function loadFromYandexDisk(
    rootPath: string,
    options: { forceRefresh?: boolean } = {},
  ): Promise<void> {
    const { forceRefresh = false } = options

    if (!forceRefresh) {
      const cached = await yandexLibraryPersistenceService.load()
      if (cached && yandexLibraryPersistenceService.isFresh(cached)) {
        console.info('[library] using cached Yandex.Disk library')
        restoreFromYandexCache(cached)
        return
      }
    }

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
            const cachedCover = coverPersistenceService.get(trackId)

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
              coverUrl: cachedCover ?? undefined,
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

      bumpCoversVersion()

      await saveYandexCache(normalizedPath)
      await saveLastSource('yandex')
    } finally {
      isLoading.value = false
    }
  }

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
            const cachedCover = coverPersistenceService.get(trackId)
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
              coverUrl: cachedCover ?? undefined,
            }
          }
          newTrackIds.push(trackId)
        }
      }

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

      const removedTrackIds = folder.trackIds.filter((id) => !newTrackIds.includes(id))
      for (const id of removedTrackIds) {
        const t = tracks.value[id]
        if (t?.coverUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(t.coverUrl)
        }
        delete tracks.value[id]
      }

      const removedFolderIds = folder.childFolderIds.filter((id) => !newChildFolderIds.includes(id))
      for (const id of removedFolderIds) {
        delete folders.value[id]
      }

      folders.value[folder.id] = {
        ...folder,
        trackIds: newTrackIds,
        childFolderIds: newChildFolderIds,
      }

      bumpCoversVersion()

      const rootFolder = rootFolderId.value ? folders.value[rootFolderId.value] : null
      if (rootFolder?.remotePath) {
        await saveYandexCache(rootFolder.remotePath)
      }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Ищет обложки для треков текущей папки через прокси (Deezer + iTunes).
   */
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
          const coverUrl = await yandexDiskService.getCover(track.artist, track.title)

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

      if (source.value === 'yandex') {
        const root = rootFolderId.value ? folders.value[rootFolderId.value] : null
        if (root?.remotePath) {
          await saveYandexCache(root.remotePath)
        }
      }

      bumpCoversVersion()
    } finally {
      isLoadingCovers.value = false
      coverProgress.value = { done: 0, total: 0 }
    }
  }

  /**
   * Сбрасывает «не найдено» для треков текущей папки.
   * После этого кнопка «Найти обложки» снова увидит их как «без обложки».
   */
  async function resetCoversForCurrentFolder(): Promise<void> {
    const folder = currentFolder.value
    if (!folder) return

    // Все треки папки
    const trackIds = currentTracks.value.map((t) => t.id)
    if (trackIds.length === 0) return

    // 1. Удаляем из кэша
    await coverPersistenceService.resetForTracks(trackIds)

    // 2. Сбрасываем coverUrl у треков, которые получили его из API
    //    (только URL, не blob — blob-обложки из folder.jpg не трогаем)
    for (const track of currentTracks.value) {
      if (track.coverUrl && !track.coverUrl.startsWith('blob:')) {
        const existing = tracks.value[track.id]
        if (existing) existing.coverUrl = undefined
      }
    }

    bumpCoversVersion()
  }

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
      const cachedCover = coverPersistenceService.get(t.id)
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
        coverUrl: cachedCover ?? undefined,
      }
    }

    folders.value = newFolders
    tracks.value = newTracks
    rootFolderId.value = cached.rootFolderId
    rootFolderName.value = cached.rootFolderName
    currentFolderId.value = cached.rootFolderId
    source.value = 'yandex'
    needsPermission.value = false

    bumpCoversVersion()
    void saveLastSource('yandex')
  }

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
    isLoadingCovers,
    coverProgress,

    hasLibrary,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    canGoUp,
    tracksWithoutCovers,
    coverStats,

    loadFromHandle,
    loadFromYandexDisk,
    restoreYandexFromCache,
    refreshCurrentYandexFolder,
    fetchCoversForCurrentFolder,
    resetCoversForCurrentFolder,
    setCurrentFolder,
    clear,
    save,
    restore,
    retryRestoreAfterPermission,
    getTrack,
    getFolder,
  }
})
