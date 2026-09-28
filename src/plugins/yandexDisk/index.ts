// src/plugins/yandexDisk/index.ts

import type { LibrarySource, LoadOptions, PluginContext } from '../types'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import type { Track } from '@/types/track'
import { PLUGIN_ID } from './constants'
import { yandexDiskService } from './YandexDiskService'
import { yandexPersistenceService } from './persistence'
import { mapWithConcurrency } from './concurrency'
import type { PersistedYandexFolder, PersistedYandexLibrary, PersistedYandexTrack } from './types'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { authService } from '@/services/auth/AuthService'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { type DownloadResult } from '../types'

const YANDEX_CONCURRENCY = 5
const ROOT_REMOTE_PATH = 'disk:/'

const yandexPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: 'Яндекс.Диск',
  icon: '☁️',

  isAvailable(): boolean {
    return typeof window !== 'undefined'
  },

  // --- Подключение ----------------------------------------------------

  async connect(context: PluginContext): Promise<void> {
    const alive = await yandexDiskService.ping()
    if (!alive) {
      throw new Error('Прокси-сервер недоступен')
    }

    const config = await yandexDiskService.getConfig()
    if (!config.hasSettings) {
      throw new Error('Сервер не настроен. Обратитесь к администратору')
    }

    if (authService.isAuthenticated()) {
      const valid = await authService.check()
      if (valid) return
    }

    const password = await context.showModal<string>({
      title: 'Вход в Яндекс.Диск',
      message: 'Введите пароль для доступа к приватным папкам',
      type: 'input',
      inputType: 'password',
      inputPlaceholder: 'Пароль',
      confirmLabel: 'Войти',
      cancelLabel: 'Отмена',
    })

    if (!password) {
      throw new Error('cancelled')
    }

    const ok = await authService.login(password)
    if (!ok) {
      throw new Error('Неверный пароль')
    }
  },

  // --- Загрузка -------------------------------------------------------

  async load(context: PluginContext, options?: LoadOptions): Promise<void> {
    const forceRefresh = options?.forceRefresh ?? false

    if (!forceRefresh) {
      const restored = await yandexPlugin.restoreFromCache(context)
      if (restored) return
    }

    const collected = await loadFromDisk()
    context.writer.setLibrary(collected, PLUGIN_ID)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  // --- Восстановление из кэша -----------------------------------------

  async restoreFromCache(context: PluginContext): Promise<boolean> {
    const cached = await yandexPersistenceService.load()
    if (!cached || !yandexPersistenceService.isFresh(cached)) {
      return false
    }

    const collected = fromPersisted(cached)
    context.writer.setLibrary(collected, PLUGIN_ID)
    return true
  },

  // --- Точечное обновление --------------------------------------------

  async refreshFolder(context: PluginContext, folderId: string): Promise<void> {
    const folder = context.writer.getFolder(folderId)
    if (!folder || !folder.remotePath) return

    await refreshSubtree(context, folder)

    const collected = currentLibraryFromWriter(context)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  // --- Стриминг -------------------------------------------------------

  buildStreamUrl(track: Track): string {
    if (typeof track.source === 'string') {
      return track.source
    }
    throw new Error('[yandex-plugin] track.source must be a string URL')
  },

  // --- Скачивание -----------------------------------------------------

  canDownload: true,

  async download(): Promise<DownloadResult> {
    throw new Error('[yandex-plugin] download not implemented yet')
  },

  // --- Отключение -----------------------------------------------------

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
    await yandexPersistenceService.clear()
    authService.logout()
  },
}

// --- Загрузка с Диска -------------------------------------------------

async function loadFromDisk(): Promise<CollectedLibrary> {
  const newFolders: Record<string, Folder> = {}
  const newTracks: Record<string, LibraryTrack> = {}

  const rootId = folderIdFromPath(`${PLUGIN_ID}:${ROOT_REMOTE_PATH}`)

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
        const trackId = trackIdFromPath(`${PLUGIN_ID}:${item.path}`)
        const cachedCover = coverPersistenceService.get(trackId)

        newTracks[trackId] = {
          id: trackId,
          pluginId: PLUGIN_ID,
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

    const childFolders = await mapWithConcurrency(subDirs, YANDEX_CONCURRENCY, async (item) => {
      const childPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name
      const childId = folderIdFromPath(`${PLUGIN_ID}:${item.path}`)
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
        remotePath === ROOT_REMOTE_PATH
          ? 'Яндекс.Диск'
          : remotePath.split('/').filter(Boolean).pop() || 'Яндекс.Диск',
      parentId,
      path: pathPrefix,
      remotePath,
      childFolderIds,
      trackIds,
      totalTrackCount: trackIds.length + childTotal,
      source: PLUGIN_ID,
    }
  }

  const rootFolder = await walk(ROOT_REMOTE_PATH, rootId, null, '')
  newFolders[rootFolder.id] = rootFolder

  return {
    folders: Object.values(newFolders),
    tracks: Object.values(newTracks),
    rootFolderId: rootFolder.id,
    rootFolderName: 'Яндекс.Диск',
  }
}

// --- Точечное обновление ----------------------------------------------

async function refreshSubtree(context: PluginContext, rootFolder: Folder): Promise<void> {
  const walk = async (folder: Folder): Promise<number> => {
    if (!folder.remotePath) return 0

    const response = await yandexDiskService.listResources(folder.remotePath)

    const newTrackIds: string[] = []
    const newChildFolderIds: string[] = []
    const subDirs: typeof response.items = []
    const newTracks: LibraryTrack[] = []

    for (const item of response.items) {
      if (item.type === 'dir') {
        subDirs.push(item)
      } else if (item.isAudio) {
        const trackId = trackIdFromPath(`${PLUGIN_ID}:${item.path}`)
        const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name

        const existing = context.writer.getTrack(trackId)
        if (!existing) {
          const cachedCover = coverPersistenceService.get(trackId)
          newTracks.push({
            id: trackId,
            pluginId: PLUGIN_ID,
            folderId: folder.id,
            filename: item.name,
            path: trackPath,
            remotePath: item.path,
            source: yandexDiskService.buildDownloadUrl(item.path),
            title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
            artist: 'Yandex Disk',
            album: folder.path || 'Yandex Disk',
            coverUrl: cachedCover ?? undefined,
          })
        }
        newTrackIds.push(trackId)
      }
    }

    if (newTracks.length > 0) {
      context.writer.addTracks(newTracks, PLUGIN_ID)
    }

    const removed = folder.trackIds.filter((id) => !newTrackIds.includes(id))
    if (removed.length > 0) {
      context.writer.removeTracks(removed)
    }

    const childFolders: Folder[] = []
    const newFolders: Folder[] = []

    for (const item of subDirs) {
      const childId = folderIdFromPath(`${PLUGIN_ID}:${item.path}`)
      const childPath = folder.path ? `${folder.path}/${item.name}` : item.name

      let childFolder = context.writer.getFolder(childId)
      if (!childFolder) {
        childFolder = {
          id: childId,
          name: item.name,
          parentId: folder.id,
          path: childPath,
          remotePath: item.path,
          childFolderIds: [],
          trackIds: [],
          totalTrackCount: 0,
          source: PLUGIN_ID,
        }
        newFolders.push(childFolder)
      }
      newChildFolderIds.push(childId)
      childFolders.push(childFolder)
    }

    if (newFolders.length > 0) {
      context.writer.addFolders(newFolders, PLUGIN_ID)
    }

    const removedFolders = folder.childFolderIds.filter((id) => !newChildFolderIds.includes(id))
    if (removedFolders.length > 0) {
      context.writer.removeFolders(removedFolders)
    }

    let childTotal = 0
    for (const child of childFolders) {
      childTotal += await walk(child)
    }

    const total = newTrackIds.length + childTotal

    context.writer.updateFolder(folder.id, {
      trackIds: newTrackIds,
      childFolderIds: newChildFolderIds,
      totalTrackCount: total,
    })

    return total
  }

  await walk(rootFolder)
}

// --- Сериализация -----------------------------------------------------

function toPersisted(collected: CollectedLibrary): PersistedYandexLibrary {
  const folders: PersistedYandexFolder[] = collected.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    remotePath: f.remotePath ?? '',
    childFolderIds: [...f.childFolderIds],
    trackIds: [...f.trackIds],
    totalTrackCount: f.totalTrackCount,
  }))

  const tracks: PersistedYandexTrack[] = []
  for (const t of collected.tracks) {
    if (!t.remotePath) continue
    tracks.push({
      id: t.id,
      pluginId: t.pluginId,
      folderId: t.folderId,
      filename: t.filename,
      path: t.path!,
      remotePath: t.remotePath,
      title: t.title,
      artist: t.artist,
      album: t.album,
    })
  }

  return {
    folders,
    tracks,
    rootFolderId: collected.rootFolderId,
    rootFolderName: collected.rootFolderName,
    rootPath: ROOT_REMOTE_PATH,
    savedAt: Date.now(),
  }
}

function fromPersisted(cached: PersistedYandexLibrary): CollectedLibrary {
  const folders: Folder[] = cached.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    path: f.path,
    remotePath: f.remotePath,
    childFolderIds: [...f.childFolderIds],
    trackIds: [...f.trackIds],
    totalTrackCount: f.totalTrackCount,
    source: PLUGIN_ID,
  }))

  const tracks: LibraryTrack[] = cached.tracks.map((t) => {
    const cachedCover = coverPersistenceService.get(t.id)
    return {
      id: t.id,
      pluginId: t.pluginId,
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
  })

  return {
    folders,
    tracks,
    rootFolderId: cached.rootFolderId,
    rootFolderName: cached.rootFolderName,
  }
}

function currentLibraryFromWriter(context: PluginContext): CollectedLibrary {
  const folders = context.writer.getFoldersBySource(PLUGIN_ID)
  const tracks = context.writer.getTracksBySource(PLUGIN_ID)
  return {
    folders,
    tracks,
    rootFolderId: folders.find((f) => f.parentId === null)?.id ?? '',
    rootFolderName: 'Яндекс.Диск',
  }
}

export default yandexPlugin
