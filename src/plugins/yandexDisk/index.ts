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
import type { CollectedLibrary, Folder, LibraryTrack } from '@/types/library'
import { PLUGIN_ID } from './constants'
import { yandexDiskService } from './YandexDiskService'
import { yandexPersistenceService } from './persistence'
import { mapWithConcurrency } from './concurrency'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { authService } from '@/services/auth/AuthService'
import {
  backgroundScan,
  currentLibraryFromWriter,
  findNearestFolder,
  loadRootContent,
  mergeFolderContent,
  refreshSubtree,
} from './scan'
import { enrichWithLocalFiles, fromPersisted, toPersisted } from './persist'

const YANDEX_CONCURRENCY = 5

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
        void backgroundScan(context, PLUGIN_ID)
        return
      }
    }

    const rootFolderId = folderIdFromPath(PLUGIN_ID, '')
    const { folders, tracks } = await loadRootContent(PLUGIN_ID, rootFolderId)

    const rootCollected: CollectedLibrary = {
      folders,
      tracks,
      rootFolderId,
      rootFolderName: 'Яндекс.Диск',
    }

    context.writer.setLibrary(rootCollected, PLUGIN_ID)
    await yandexPersistenceService.save(toPersisted(rootCollected))
    void backgroundScan(context, PLUGIN_ID)
  },

  async restoreFromCache(context: PluginContext): Promise<boolean> {
    const cached = await yandexPersistenceService.load()
    if (!cached || !yandexPersistenceService.isFresh(cached)) return false

    const collected = fromPersisted(cached)
    const targetDir = await context.getDownloadDir()
    if (targetDir) {
      await enrichWithLocalFiles(collected.tracks, targetDir)
    }
    context.writer.setLibrary(collected, PLUGIN_ID)

    void backgroundScan(context, PLUGIN_ID)

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
        const response = await yandexDiskService.listResources(folder.remotePath)
        mergeFolderContent(
          context,
          folder,
          response.items,
          options.removeMissing === true,
          PLUGIN_ID,
        )
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

    // Рекурсивно обходим подпапки
    const updated = context.writer.getFolder(folderId)
    if (!updated) return false

    const childFolders = updated.childFolderIds
      .map((id) => context.writer.getFolder(id))
      .filter((f): f is Folder => Boolean(f))

    const childReady = await mapWithConcurrency(childFolders, YANDEX_CONCURRENCY, (child) =>
      yandexPlugin.scanFolder!(context, child.id, options),
    )

    const childTrackTotal = childFolders.reduce((sum, child) => {
      const c = context.writer.getFolder(child.id)
      return sum + (c?.totalTrackCount ?? 0)
    }, 0)

    const childTextTotal = childFolders.reduce((sum, child) => {
      const c = context.writer.getFolder(child.id)
      return sum + (c?.totalTextFileCount ?? 0)
    }, 0)

    const final = context.writer.getFolder(folderId)
    if (!final) return false

    const allChildrenReady = childReady.every((r) => r === true)
    const isReady = final.scanStatus === 'scanned' && allChildrenReady

    context.writer.updateFolder(folderId, {
      totalTrackCount: final.trackIds.length + childTrackTotal,
      totalTextFileCount: (final.textFiles?.length ?? 0) + childTextTotal,
      ready: isReady,
    })

    return isReady
  },

  async refreshFolder(context: PluginContext, folderId: string): Promise<void> {
    const folder = context.writer.getFolder(folderId)
    if (!folder || !folder.remotePath) return

    await refreshSubtree(context, folder, PLUGIN_ID)

    await yandexPersistenceService.save(toPersisted(currentLibraryFromWriter(context, PLUGIN_ID)))
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

    const folder = findNearestFolder(context.writer, PLUGIN_ID, relativePath)
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
    const collected = currentLibraryFromWriter(context, PLUGIN_ID)
    await yandexPersistenceService.save(toPersisted(collected))
  },

  async disconnect(context: PluginContext): Promise<void> {
    context.writer.removeBySource(PLUGIN_ID)
    await yandexPersistenceService.clear()
    authService.logout()
  },
}

export default yandexPlugin
