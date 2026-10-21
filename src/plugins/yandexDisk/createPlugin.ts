// src/plugins/yandexDisk/createPlugin.ts

import type {
  LibrarySource,
  PluginContext,
  ScanFolderOptions,
  ScanResult,
  DownloadTrackOptions,
  DownloadedTrackInfo,
  LoadOptions,
} from '../types'
import type { LibraryTrack, Folder, CollectedLibrary } from '@/types/library'
import { folderIdFromPath, trackIdFromPath } from '@/services/library/id'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import { mapWithConcurrency } from './concurrency'
import { yandexPersistenceService } from './persistence'
import {
  backgroundScan,
  currentLibraryFromWriter,
  findNearestFolder,
  loadRootContent,
  mergeFolderContent,
  refreshSubtree,
} from './scan'
import { enrichWithLocalFiles, fromPersisted, toPersisted } from './persist'
import { authService } from '@/services/auth/AuthService'
import { useLibraryStore } from '@/stores/library'
import type { IYandexService } from './types'

const YANDEX_CONCURRENCY = 5

export interface YandexPluginOptions {
  id: string
  name: string
  icon: string
  service: IYandexService
  isSelf?: boolean
}

export function createYandexPlugin({
  id,
  name,
  icon,
  service,
  isSelf = false,
}: YandexPluginOptions): LibrarySource {
  // Локальный флаг отмены для предотвращения гонки данных
  let cancelled = false
  service.isCancelled = () => cancelled
  service.setCancelled = (val: boolean) => {
    cancelled = val
  }

  return {
    id,
    name,
    icon,
    canDownload: true,
    isAvailable: () => typeof window !== 'undefined',

    async connect(context: PluginContext): Promise<void> {
      if (service.setDisconnected) {
        service.setDisconnected(false)
      }
      if (service.setCancelled) {
        service.setCancelled(false)
      }

      if (isSelf) {
        if (!service.login) throw new Error('Service does not support login')

        const code = await context.showModal<string>({
          title: `Вход в ${name}`,
          message: 'Введите пароль (необязательно)',
          type: 'input',
          inputType: 'password',
        })

        // ВАЖНО: null означает отмену, а '' (пустая строка) — валидный пустой пароль
        if (code === null) throw new Error('cancelled')

        let ctx = 'common'
        let password = code

        if (code.includes(':')) {
          const parts = code.split(':')
          ctx = parts[0] || 'common'
          password = parts[1] || ''
        }

        const ok = await service.login(ctx, password)
        if (!ok) throw new Error('Неверный пароль или контекст')
      } else {
        const alive = service.ping ? await service.ping() : true
        if (!alive) throw new Error('Сервер недоступен')

        const me = await authService.me()
        if (me.authenticated) return

        authService.startOAuth()
        throw new Error('redirect')
      }
    },

    async load(context: PluginContext, options?: LoadOptions): Promise<void> {
      const forceRefresh = options?.forceRefresh ?? false

      if (!forceRefresh) {
        const restored = await this.restoreFromCache!(context)
        if (restored) {
          void backgroundScan(context, id, service)
          return
        }
      }

      const rootFolderId = folderIdFromPath(id, '')
      const { folders, tracks } = await loadRootContent(id, rootFolderId, service)

      const rootCollected: CollectedLibrary = {
        folders,
        tracks,
        rootFolderId,
        rootFolderName: name,
      }

      context.writer.setLibrary(rootCollected, id)
      await yandexPersistenceService.save(id, toPersisted(rootCollected))
      void backgroundScan(context, id, service)
    },

    async restoreFromCache(context: PluginContext): Promise<boolean> {
      if (service.isDisconnected && service.isDisconnected()) {
        return false
      }

      const cached = await yandexPersistenceService.load(id)
      if (!cached || !yandexPersistenceService.isFresh(cached)) return false

      const collected = fromPersisted(cached, service)
      const targetDir = await context.getDownloadDir()
      if (targetDir) {
        await enrichWithLocalFiles(collected.tracks, targetDir)
      }
      context.writer.setLibrary(collected, id)

      void backgroundScan(context, id, service)
      return true
    },

    async scanFolder(
      context: PluginContext,
      folderId: string,
      options: ScanFolderOptions,
    ): Promise<boolean> {
      const folder = context.writer.getFolder(folderId)
      if (!folder || !folder.remotePath) return false

      if (folder.scanStatus === 'scanning') return folder.ready ?? false

      const needScan = folder.scanStatus !== 'scanned' || options.removeMissing === true

      if (needScan) {
        context.writer.updateFolder(folderId, { scanStatus: 'scanning' })
        try {
          const response = await service.listResources(folder.remotePath)
          mergeFolderContent(
            context,
            folder,
            response._embedded?.items || response.items || [],
            options.removeMissing === true,
            id,
            service,
          )
        } catch (err) {
          console.warn(`[${id}] scan failed for "${folder.path}":`, err)
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
        .map((fid) => context.writer.getFolder(fid))
        .filter((f): f is Folder => Boolean(f))

      const childReady = await mapWithConcurrency(childFolders, YANDEX_CONCURRENCY, (child) =>
        this.scanFolder!(context, child.id, options),
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
      await refreshSubtree(context, folder, id, service)
      await yandexPersistenceService.save(id, toPersisted(currentLibraryFromWriter(context, id)))
    },

    buildStreamUrl(track: LibraryTrack): string {
      if (typeof track.source === 'string') return track.source
      throw new Error(`[${id}] track.source must be string`)
    },

    buildDownloadUrl(track: LibraryTrack): string {
      return this.buildStreamUrl(track)
    },

    async downloadTrack(
      _context: PluginContext,
      track: LibraryTrack,
      options: DownloadTrackOptions,
    ): Promise<DownloadedTrackInfo> {
      const url = this.buildDownloadUrl!(track)
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
        let dir = targetDir
        for (const seg of segments) dir = await dir.getDirectoryHandle(seg)
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
      const allTracks = context.writer.getTracksBySource(id)

      const byPath = new Map<string, LibraryTrack>()
      for (const track of allTracks) {
        byPath.set(track.path ?? track.filename, track)
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
        if (!files.has(track.path ?? track.filename)) missing.push(track.id)
      }

      return { downloaded, onlyLocal, missing }
    },

    async createLocalTrack(
      context: PluginContext,
      relativePath: string,
      filename: string,
    ): Promise<LibraryTrack | null> {
      const trackId = trackIdFromPath(id, relativePath)
      if (context.writer.getTrack(trackId)) return null

      const targetDir = await context.getDownloadDir()
      if (!targetDir) return null

      const file = await getFileFromPath(targetDir, relativePath)
      if (!file) return null

      const folder = findNearestFolder(context.writer, id, relativePath)
      if (!folder) return null

      const metadata = await parseTrackMetadata(file, {
        folderName: relativePath.split('/').slice(-2)[0],
      })

      return {
        id: trackId,
        pluginId: id,
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
      const collected = currentLibraryFromWriter(context, id)
      await yandexPersistenceService.save(id, toPersisted(collected))
    },

    async disconnect(context: PluginContext): Promise<void> {
      if (service.setCancelled) {
        service.setCancelled(true)
      }

      context.writer.removeBySource(id)

      const library = useLibraryStore()

      library.folders = Object.fromEntries(
        Object.entries(library.folders).filter(([, f]) => {
          if (!f.source) return true
          return f.source !== id && !f.source.startsWith(id + ':')
        }),
      )

      library.tracks = Object.fromEntries(
        Object.entries(library.tracks).filter(([, t]) => {
          if (!t.pluginId) return true
          return t.pluginId !== id && !t.pluginId.startsWith(id + ':')
        }),
      )

      if (service.setDisconnected) {
        service.setDisconnected(true)
      }

      await yandexPersistenceService.clear(id)
      if (service.logout) service.logout()
    },
  }
}
