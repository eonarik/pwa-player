// src/plugins/yandexDisk/index.ts

import type {
  DownloadTrackOptions,
  DownloadedTrackInfo,
  LibrarySource,
  LoadOptions,
  PluginContext,
  ScanFolderOptions,
  ScanResult,
} from '../types'
import type { CollectedLibrary, Folder, LibraryTrack, TextFileRef } from '@/types/library'
import { PLUGIN_ID } from './constants'
import { yandexDiskService } from './YandexDiskService'
import { yandexPersistenceService } from './persistence'
import { mapWithConcurrency } from './concurrency'
import type { PersistedYandexFolder, PersistedYandexLibrary, PersistedYandexTrack } from './types'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { authService } from '@/services/auth/AuthService'
import { metadataPersistenceService } from '@/services/persistence/MetadataPersistenceService'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import type { LibraryWriter } from '../types'

const YANDEX_CONCURRENCY = 5
const ROOT_REMOTE_PATH = 'disk:/'

function isTextFile(name: string): boolean {
  return name.toLowerCase().endsWith('.txt')
}

const yandexPlugin: LibrarySource = {
  id: PLUGIN_ID,
  name: 'Яндекс.Диск',
  icon: '☁️',

  isAvailable(): boolean {
    return typeof window !== 'undefined'
  },

  async connect(context: PluginContext): Promise<void> {
    const alive = await yandexDiskService.ping()
    if (!alive) throw new Error('Прокси-сервер недоступен')

    const config = await yandexDiskService.getConfig()
    if (!config.hasSettings) throw new Error('Сервер не настроен. Обратитесь к администратору')

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

    if (!password) throw new Error('cancelled')

    const ok = await authService.login(password)
    if (!ok) throw new Error('Неверный пароль')
  },

  async load(context: PluginContext, options?: LoadOptions): Promise<void> {
    const forceRefresh = options?.forceRefresh ?? false

    if (!forceRefresh) {
      const restored = await yandexPlugin.restoreFromCache(context)
      if (restored) {
        void backgroundScan(context)
        return
      }
    }

    const rootCollected = await loadRoot()
    context.writer.setLibrary(rootCollected, PLUGIN_ID)

    void backgroundScan(context)
  },

  async restoreFromCache(context) {
    const cached = await yandexPersistenceService.load()
    if (!cached || !yandexPersistenceService.isFresh(cached)) return false

    const collected = fromPersisted(cached)
    const targetDir = await context.getDownloadDir()
    if (targetDir) {
      await enrichWithLocalFiles(collected.tracks, targetDir)
    }
    context.writer.setLibrary(collected, PLUGIN_ID)

    void backgroundScan(context)

    return true
  },

  async scanFolder(
    context: PluginContext,
    folderId: string,
    options: ScanFolderOptions,
  ): Promise<boolean> {
    const folder = context.writer.getFolder(folderId)
    if (!folder || !folder.remotePath) return false

    if (folder.scanStatus === 'scanning') {
      return folder.ready ?? false
    }

    const needScan = folder.scanStatus !== 'scanned' || options.removeMissing === true

    if (needScan) {
      context.writer.updateFolder(folderId, { scanStatus: 'scanning' })
      try {
        await scanFolderImpl(context, folder, options.removeMissing === true)
      } catch (err) {
        console.warn(
          `[yandex] scan failed for "${folder.path}": ${err instanceof Error ? err.message : err}`,
        )
      }
      context.writer.updateFolder(folderId, { scanStatus: 'scanned' })
    }

    if (!options.recursive) {
      const updated = context.writer.getFolder(folderId)
      const isReady =
        updated?.scanStatus === 'scanned' && (updated.childFolderIds.length ?? 0) === 0
      context.writer.updateFolder(folderId, { ready: isReady })
      return isReady
    }

    const updated = context.writer.getFolder(folderId)
    if (!updated) return false

    const childFolders = updated.childFolderIds
      .map((id) => context.writer.getFolder(id))
      .filter((f): f is Folder => Boolean(f))

    const childReady = await mapWithConcurrency(childFolders, YANDEX_CONCURRENCY, (child) =>
      yandexPlugin.scanFolder!(context, child.id, options),
    )

    const childTotal = childFolders.reduce((sum, child) => {
      const c = context.writer.getFolder(child.id)
      return sum + (c?.totalTrackCount ?? 0)
    }, 0)

    const final = context.writer.getFolder(folderId)
    if (!final) return false

    const allChildrenReady = childReady.every((r) => r === true)
    const isReady = final.scanStatus === 'scanned' && allChildrenReady

    context.writer.updateFolder(folderId, {
      totalTrackCount: final.trackIds.length + childTotal,
      ready: isReady,
    })

    return isReady
  },

  async refreshFolder(context: PluginContext, folderId: string): Promise<void> {
    const folder = context.writer.getFolder(folderId)
    if (!folder || !folder.remotePath) return

    await refreshSubtree(context, folder)

    const collected = currentLibraryFromWriter(context)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  buildStreamUrl(track: LibraryTrack): string {
    if (typeof track.source === 'string') return track.source
    throw new Error('[yandex-plugin] track.source must be a string URL')
  },

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
      if (err instanceof DOMException && err.name === 'NotFoundError') return
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
      if (!files.has(rel)) missing.push(track.id)
    }

    return { downloaded, onlyLocal, missing }
  },

  async createLocalTrack(
    context: PluginContext,
    relativePath: string,
    filename: string,
  ): Promise<LibraryTrack | null> {
    const trackId = trackIdFromPath(PLUGIN_ID, relativePath)
    if (context.writer.getTrack(trackId)) return null

    const targetDir = await context.getDownloadDir()
    if (!targetDir) return null

    const file = await getFileFromPath(targetDir, relativePath)
    if (!file) return null

    const folder = findNearestFolder(context.writer, relativePath)
    if (!folder) return null

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

  async saveCache(context: PluginContext): Promise<void> {
    const collected = currentLibraryFromWriter(context)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
    await yandexPersistenceService.clear()
    authService.logout()
  },
}

// --- Загрузка корня ---------------------------------------------------

async function loadRoot(): Promise<CollectedLibrary> {
  const response = await yandexDiskService.listResources(ROOT_REMOTE_PATH)
  const rootId = folderIdFromPath(PLUGIN_ID, '')

  const folders: Folder[] = []
  const tracks: LibraryTrack[] = []
  const childFolderIds: string[] = []
  const trackIds: string[] = []
  const textFiles: TextFileRef[] = []

  for (const item of response.items) {
    if (item.type === 'dir') {
      const childPath = item.name
      const childId = folderIdFromPath(PLUGIN_ID, childPath)
      folders.push({
        id: childId,
        name: item.name,
        parentId: rootId,
        path: childPath,
        remotePath: item.path,
        childFolderIds: [],
        trackIds: [],
        totalTrackCount: 0,
        source: PLUGIN_ID,
        scanStatus: undefined,
        ready: false,
      })
      childFolderIds.push(childId)
    } else if (item.isAudio) {
      const trackPath = item.name
      const trackId = trackIdFromPath(PLUGIN_ID, trackPath)
      const cachedCover = metadataPersistenceService.get(trackId)?.coverUrl ?? undefined

      tracks.push({
        id: trackId,
        pluginId: PLUGIN_ID,
        folderId: rootId,
        filename: item.name,
        path: trackPath,
        remotePath: item.path,
        source: yandexDiskService.buildDownloadUrl(item.path),
        title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
        artist: '',
        album: 'Yandex Disk',
        coverUrl: cachedCover,
      })
      trackIds.push(trackId)
    } else if (item.type === 'file' && isTextFile(item.name)) {
      textFiles.push({
        name: item.name,
        remotePath: item.path,
        path: item.name,
      })
    }
  }

  const rootFolder: Folder = {
    id: rootId,
    name: 'Яндекс.Диск',
    parentId: null,
    path: '',
    remotePath: ROOT_REMOTE_PATH,
    childFolderIds,
    trackIds,
    totalTrackCount: trackIds.length,
    source: PLUGIN_ID,
    scanStatus: 'scanned',
    ready: false,
    textFiles,
  }

  return {
    folders: [rootFolder, ...folders],
    tracks,
    rootFolderId: rootId,
    rootFolderName: 'Яндекс.Диск',
  }
}

// --- Обход одной папки -----------------------------------------------

async function scanFolderImpl(
  context: PluginContext,
  folder: Folder,
  removeMissing: boolean,
): Promise<void> {
  if (!folder.remotePath) return

  const response = await yandexDiskService.listResources(folder.remotePath)

  const childFolderIds: string[] = []
  const remoteTrackIds: string[] = []
  const newFolders: Folder[] = []
  const newTracks: LibraryTrack[] = []
  const subDirs: typeof response.items = []
  const textFiles: TextFileRef[] = []

  for (const item of response.items) {
    if (item.type === 'dir') {
      subDirs.push(item)
    } else if (item.isAudio) {
      const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name
      const trackId = trackIdFromPath(PLUGIN_ID, trackPath)

      if (!context.writer.getTrack(trackId)) {
        const cachedCover = metadataPersistenceService.get(trackId)?.coverUrl ?? undefined
        newTracks.push({
          id: trackId,
          pluginId: PLUGIN_ID,
          folderId: folder.id,
          filename: item.name,
          path: trackPath,
          remotePath: item.path,
          source: yandexDiskService.buildDownloadUrl(item.path),
          title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
          artist: '',
          album: folder.path || 'Yandex Disk',
          coverUrl: cachedCover,
        })
      }
      remoteTrackIds.push(trackId)
    } else if (item.type === 'file' && isTextFile(item.name)) {
      const textPath = folder.path ? `${folder.path}/${item.name}` : item.name
      textFiles.push({
        name: item.name,
        remotePath: item.path,
        path: textPath,
      })
    }
  }

  for (const item of subDirs) {
    const childPath = folder.path ? `${folder.path}/${item.name}` : item.name
    const childId = folderIdFromPath(PLUGIN_ID, childPath)

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
        scanStatus: undefined,
        ready: false,
      }
      newFolders.push(childFolder)
    }
    childFolderIds.push(childId)
  }

  if (newTracks.length > 0) context.writer.addTracks(newTracks, PLUGIN_ID)
  if (newFolders.length > 0) context.writer.addFolders(newFolders, PLUGIN_ID)

  const onlyLocalIds = folder.trackIds.filter((id) => {
    const t = context.writer.getTrack(id)
    return t?.origin === 'only-local'
  })

  let finalTrackIds: string[]

  if (removeMissing) {
    const currentRemoteIds = folder.trackIds.filter((id) => {
      const t = context.writer.getTrack(id)
      return t && t.origin !== 'only-local'
    })
    const removed = currentRemoteIds.filter((id) => !remoteTrackIds.includes(id))
    if (removed.length > 0) {
      context.writer.removeTracks(removed)
    }
    finalTrackIds = [...remoteTrackIds, ...onlyLocalIds]
  } else {
    const existing = new Set(folder.trackIds)
    const added = remoteTrackIds.filter((id) => !existing.has(id))
    finalTrackIds = [...folder.trackIds, ...added]
    finalTrackIds = Array.from(new Set(finalTrackIds))
  }

  context.writer.updateFolder(folder.id, {
    childFolderIds,
    trackIds: finalTrackIds,
    textFiles,
  })
}

// --- Фоновый обход ----------------------------------------------------

async function backgroundScan(context: PluginContext): Promise<void> {
  const allFolders = context.writer.getFoldersBySource(PLUGIN_ID)
  const unready = allFolders.filter((f) => f.ready !== true)
  console.info('[yandex] background scan check:', {
    total: allFolders.length,
    unready: unready.length,
  })

  const rootFolder = context.writer.getFoldersBySource(PLUGIN_ID).find((f) => f.parentId === null)
  if (!rootFolder) return

  const hasUnready = context.writer.getFoldersBySource(PLUGIN_ID).some((f) => f.ready !== true)

  if (!hasUnready) return

  console.info('[yandex] background scan: start')

  await yandexPlugin.scanFolder!(context, rootFolder.id, { recursive: true })

  console.info('[yandex] background scan: complete')

  const collected = currentLibraryFromWriter(context)
  await yandexPersistenceService.save(toPersisted(collected))
}

// --- Поиск ближайшей существующей папки ------------------------------

function findNearestFolder(writer: LibraryWriter, relativePath: string): Folder | null {
  const segments = relativePath.split('/').filter(Boolean)
  segments.pop()

  const folders = writer.getFoldersBySource(PLUGIN_ID)

  while (segments.length > 0) {
    const candidatePath = segments.join('/')
    const folder = folders.find((f) => f.path === candidatePath)
    if (folder) return folder
    segments.pop()
  }

  return folders.find((f) => f.parentId === null) ?? null
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
    const textFiles: TextFileRef[] = []

    for (const item of response.items) {
      if (item.type === 'dir') {
        subDirs.push(item)
      } else if (item.isAudio) {
        const trackPath = folder.path ? `${folder.path}/${item.name}` : item.name
        const trackId = trackIdFromPath(PLUGIN_ID, trackPath)

        if (!context.writer.getTrack(trackId)) {
          const cachedCover = metadataPersistenceService.get(trackId)?.coverUrl ?? undefined
          newTracks.push({
            id: trackId,
            pluginId: PLUGIN_ID,
            folderId: folder.id,
            filename: item.name,
            path: trackPath,
            remotePath: item.path,
            source: yandexDiskService.buildDownloadUrl(item.path),
            title: item.name.replace(/\.[^.]+$/, '').replace(/^\d{1,3}[\s._-]+/, ''),
            artist: '',
            album: folder.path || 'Yandex Disk',
            coverUrl: cachedCover,
          })
        }
        newTrackIds.push(trackId)
      } else if (item.type === 'file' && isTextFile(item.name)) {
        const textPath = folder.path ? `${folder.path}/${item.name}` : item.name
        textFiles.push({
          name: item.name,
          remotePath: item.path,
          path: textPath,
        })
      }
    }

    if (newTracks.length > 0) context.writer.addTracks(newTracks, PLUGIN_ID)

    const removed = folder.trackIds.filter((id) => !newTrackIds.includes(id))
    if (removed.length > 0) context.writer.removeTracks(removed)

    const childFolders: Folder[] = []
    const newFolders: Folder[] = []

    for (const item of subDirs) {
      const childPath = folder.path ? `${folder.path}/${item.name}` : item.name
      const childId = folderIdFromPath(PLUGIN_ID, childPath)

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
          scanStatus: undefined,
          ready: false,
        }
        newFolders.push(childFolder)
      }
      newChildFolderIds.push(childId)
      childFolders.push(childFolder)
    }

    if (newFolders.length > 0) context.writer.addFolders(newFolders, PLUGIN_ID)

    const removedFolders = folder.childFolderIds.filter((id) => !newChildFolderIds.includes(id))
    if (removedFolders.length > 0) context.writer.removeFolders(removedFolders)

    let childTotal = 0
    for (const child of childFolders) {
      childTotal += await walk(child)
    }

    const total = newTrackIds.length + childTotal

    context.writer.updateFolder(folder.id, {
      trackIds: newTrackIds,
      childFolderIds: newChildFolderIds,
      totalTrackCount: total,
      scanStatus: 'scanned',
      ready: true,
      textFiles,
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
    if (track.origin !== 'downloaded' && track.origin !== 'only-local') continue

    const relativePath = track.path ?? track.filename
    const file = await getFileFromPath(targetDir, relativePath)

    if (file) {
      track.source = file
    } else {
      if (track.origin === 'downloaded') {
        track.origin = 'remote'
      } else if (track.origin === 'only-local') {
        track.origin = 'remote'
      }
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
    scanStatus: f.scanStatus,
    ready: f.ready,
    textFiles: f.textFiles,
  }))

  const tracks: PersistedYandexTrack[] = []
  for (const t of collected.tracks) {
    const isOnlyLocal = t.origin === 'only-local'
    if (!t.remotePath && !isOnlyLocal) continue

    tracks.push({
      id: t.id,
      pluginId: t.pluginId,
      folderId: t.folderId,
      filename: t.filename,
      path: t.path!,
      remotePath: t.remotePath ?? '',
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
    scanStatus: f.scanStatus === 'scanning' ? undefined : f.scanStatus,
    ready: f.ready,
    textFiles: f.textFiles,
  }))

  const tracks: LibraryTrack[] = cached.tracks.map((t) => {
    const cachedCover = metadataPersistenceService.get(t.id)?.coverUrl ?? undefined
    const isOnlyLocal = t.origin === 'only-local'
    const source = t.remotePath ? yandexDiskService.buildDownloadUrl(t.remotePath) : ''

    return {
      id: t.id,
      pluginId: t.pluginId,
      folderId: t.folderId,
      filename: t.filename,
      path: t.path,
      remotePath: t.remotePath || undefined,
      source,
      title: t.title,
      artist: t.artist,
      album: t.album,
      coverUrl: cachedCover,
      origin: t.origin,
      duration: t.duration,
      ...(isOnlyLocal ? {} : {}),
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
