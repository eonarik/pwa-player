// src/plugins/yandexDisk/index.ts

import type {
  DownloadTrackOptions,
  DownloadedTrackInfo,
  LibrarySource,
  LoadOptions,
  PluginContext,
  ScanResult,
} from '../types'
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import { PLUGIN_ID } from './constants'
import { yandexDiskService } from './YandexDiskService'
import { yandexPersistenceService } from './persistence'
import { mapWithConcurrency } from './concurrency'
import type { PersistedYandexFolder, PersistedYandexLibrary, PersistedYandexTrack } from './types'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { authService } from '@/services/auth/AuthService'
import { coverPersistenceService } from '@/services/persistence/CoverPersistenceService'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import type { LibraryWriter } from '../types'

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

    // Подтягиваем локальные файлы для уже скачанных треков
    const targetDir = await context.getDownloadDir()
    if (targetDir) {
      await enrichWithLocalFiles(collected.tracks, targetDir)
    }

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

  buildStreamUrl(track: LibraryTrack): string {
    if (typeof track.source === 'string') {
      return track.source
    }
    throw new Error('[yandex-plugin] track.source must be a string URL')
  },

  // --- Скачивание -----------------------------------------------------

  canDownload: true,

  buildDownloadUrl(track: LibraryTrack): string {
    return yandexPlugin.buildStreamUrl(track)
  },

  async downloadTrack(
    _context: PluginContext,
    track: LibraryTrack,
    options: DownloadTrackOptions,
  ): Promise<DownloadedTrackInfo> {
    const url = yandexPlugin.buildDownloadUrl!(track)
    const relativePath = track.path ?? track.filename

    const result = await downloadUrlToFile(url, {
      targetDir: options.targetDir,
      relativePath,
      onProgress: options.onProgress,
      signal: options.signal,
    })

    return { relativePath, size: result.size }
  },

  async removeDownloaded(
    _context: PluginContext,
    track: LibraryTrack,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<void> {
    const relativePath = track.path ?? track.filename
    const segments = relativePath.split('/').filter(Boolean)
    const fileName = segments.pop()
    if (!fileName) return

    try {
      let dir: FileSystemDirectoryHandle = targetDir
      for (const seg of segments) {
        dir = await dir.getDirectoryHandle(seg)
      }
      await dir.removeEntry(fileName)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        return
      }
      throw err
    }
  },

  async scanDownloadDir(
    context: PluginContext,
    targetDir: FileSystemDirectoryHandle,
  ): Promise<ScanResult> {
    const files = await scanDirectory(targetDir)
    const allTracks = context.writer.getTracksBySource(PLUGIN_ID)

    const byPath = new Map<string, LibraryTrack>()
    for (const track of allTracks) {
      const rel = track.path ?? track.filename
      byPath.set(rel, track)
    }

    const downloaded = new Map<string, string>()
    const matchedPaths = new Set<string>()

    for (const filePath of files.keys()) {
      const track = byPath.get(filePath)
      if (track) {
        downloaded.set(track.id, filePath)
        matchedPaths.add(filePath)
      }
    }

    const onlyLocal: Array<{ relativePath: string; filename: string }> = []
    for (const [filePath, file] of files) {
      if (matchedPaths.has(filePath)) continue
      onlyLocal.push({ relativePath: filePath, filename: file.handle.name })
    }

    const missing: string[] = []
    for (const track of allTracks) {
      if (track.origin !== 'downloaded') continue
      const rel = track.path ?? track.filename
      if (!files.has(rel)) {
        missing.push(track.id)
      }
    }

    return { downloaded, onlyLocal, missing }
  },

  // --- Создание only-local трека --------------------------------------

  async createLocalTrack(
    context: PluginContext,
    relativePath: string,
    filename: string,
  ): Promise<LibraryTrack | null> {
    // 1. Строим trackId в том же формате, что и для облачных
    const trackId = trackIdFromPath(`${PLUGIN_ID}:${relativePath}`)

    // 2. Если трек уже есть в библиотеке — не создаём дубликат
    if (context.writer.getTrack(trackId)) return null

    // 3. Достаём File из папки спейса
    const targetDir = await context.getDownloadDir()
    if (!targetDir) return null

    const file = await getFileFromPath(targetDir, relativePath)
    if (!file) return null

    // 4. Ищем ближайшую существующую папку
    const folder = findNearestFolder(context.writer, relativePath)
    if (!folder) return null

    // 5. Парсим метаданные
    const metadata = await parseTrackMetadata(file, {
      folderName: relativePath.split('/').slice(-2)[0],
    })

    return {
      id: trackId,
      pluginId: PLUGIN_ID,
      folderId: folder.id,
      filename,
      path: relativePath,
      source: file,
      origin: 'only-local',
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      duration: metadata.duration,
      coverUrl: metadata.coverUrl,
    }
  },

  // --- Сохранение кэша ------------------------------------------------

  async saveCache(context: PluginContext): Promise<void> {
    const collected = currentLibraryFromWriter(context)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  // --- Отключение -----------------------------------------------------

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
    await yandexPersistenceService.clear()
    authService.logout()
  },
}

// --- Поиск ближайшей существующей папки ------------------------------

/**
 * Для relativePath 'Music/Album/bonus.mp3' ищет папку 'Music/Album',
 * потом 'Music', потом корень плагина.
 *
 * Возвращает null, если ни одной папки нет (библиотека пуста).
 */
function findNearestFolder(writer: LibraryWriter, relativePath: string): Folder | null {
  const segments = relativePath.split('/').filter(Boolean)
  segments.pop() // убираем filename

  const folders = writer.getFoldersBySource(PLUGIN_ID)

  while (segments.length > 0) {
    const candidatePath = segments.join('/')
    const folder = folders.find((f) => f.path === candidatePath)
    if (folder) return folder
    segments.pop()
  }

  // Fallback — корень плагина
  return folders.find((f) => f.parentId === null) ?? null
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

    let response
    try {
      response = await yandexDiskService.listResources(folder.remotePath)
    } catch (err) {
      console.warn(
        `[yandex] skip folder "${folder.path}": ${err instanceof Error ? err.message : err}`,
      )
      return 0
    }

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

// --- Обогащение локальными файлами -----------------------------------

async function enrichWithLocalFiles(
  tracks: LibraryTrack[],
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  for (const track of tracks) {
    if (track.origin !== 'downloaded') continue

    const relativePath = track.path ?? track.filename
    const file = await getFileFromPath(targetDir, relativePath)

    if (file) {
      track.source = file
    } else {
      track.origin = 'remote'
    }
  }
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
      origin: t.origin,
      duration: t.duration,
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
      origin: t.origin,
      duration: t.duration,
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
