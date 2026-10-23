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
import type { LibraryTrack, CollectedLibrary } from '@/types/library'
import { folderIdFromPath } from '@/services/library/id'
import { yandexPersistenceService } from './persistence'
import { backgroundScan, currentLibraryFromWriter, loadRootContent, refreshSubtree } from './scan'
import { fromPersisted, toPersisted, enrichWithLocalFiles } from './persist'
import { authService } from '@/services/auth/AuthService'
import type { IYandexService } from './types'
import { scanFolderRecursive } from './scanFolder'
import { downloadTrackToDir, removeDownloadedFromDir } from './download'
import {
  scanDownloadDirForSource,
  createLocalTrackFromFile,
  restoreLibraryFromFiles,
  mergeLocalIntoLibrary,
} from './sync'

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
    isDisconnected: () => service.isDisconnected?.() ?? false,

    async connect(context: PluginContext): Promise<void> {
      if (service.setDisconnected) service.setDisconnected(false)
      if (service.setCancelled) service.setCancelled(false)

      if (isSelf) {
        if (!service.login) throw new Error('Service does not support login')

        const code = await context.showModal<string>({
          title: `Вход в ${name}`,
          message: 'Введите пароль (необязательно)',
          type: 'input',
          inputType: 'password',
        })

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
          if (!service.isDisconnected || !service.isDisconnected()) {
            void backgroundScan(context, id, service)
          }
          return
        }
      }

      const targetDir = await context.getDownloadDir()
      if (targetDir) {
        try {
          await mergeLocalIntoLibrary({ sourceId: id }, context, targetDir)
        } catch (err) {
          console.warn(`[${id}] load: mergeLocalIntoLibrary failed`, err)
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

      if (targetDir) {
        try {
          await mergeLocalIntoLibrary({ sourceId: id }, context, targetDir)
        } catch (err) {
          console.warn(`[${id}] load: mergeLocalIntoLibrary (post) failed`, err)
        }
      }

      await yandexPersistenceService.save(id, toPersisted(currentLibraryFromWriter(context, id)))
      void backgroundScan(context, id, service)
    },

    async restoreFromCache(context: PluginContext): Promise<boolean> {
      const cached = await yandexPersistenceService.load(id)
      if (!cached || !yandexPersistenceService.isFresh(cached)) return false

      const collected = fromPersisted(cached, service)
      const targetDir = await context.getDownloadDir()
      if (targetDir) {
        await enrichWithLocalFiles(collected.tracks, targetDir, service)
      }
      context.writer.setLibrary(collected, id)

      if (!service.isDisconnected || !service.isDisconnected()) {
        void backgroundScan(context, id, service)
      }
      return true
    },

    async restoreFromLocalFiles(context: PluginContext): Promise<boolean> {
      const targetDir = await context.getDownloadDir()
      if (!targetDir) return false
      return restoreLibraryFromFiles({ sourceId: id }, context, targetDir)
    },

    async mergeLocalIntoLibrary(context: PluginContext): Promise<void> {
      const targetDir = await context.getDownloadDir()
      if (!targetDir) return
      await mergeLocalIntoLibrary({ sourceId: id }, context, targetDir)
    },

    async scanFolder(
      context: PluginContext,
      folderId: string,
      options: ScanFolderOptions,
    ): Promise<boolean> {
      return scanFolderRecursive({ context, sourceId: id, service }, folderId, options)
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

    /**
     * URL для скачивания трека. Строится из `remotePath`, не из `source`.
     */
    buildDownloadUrl(track: LibraryTrack): string {
      if (!track.remotePath) {
        throw new Error(`[${id}] track "${track.id}" has no remotePath`)
      }
      return service.buildDownloadUrl(track.remotePath)
    },

    async downloadTrack(
      context: PluginContext,
      track: LibraryTrack,
      options: DownloadTrackOptions,
    ): Promise<DownloadedTrackInfo> {
      return downloadTrackToDir(
        { buildDownloadUrl: (t) => this.buildDownloadUrl!(t) },
        context,
        track,
        options,
      )
    },

    async removeDownloaded(
      context: PluginContext,
      track: LibraryTrack,
      targetDir: FileSystemDirectoryHandle,
    ): Promise<void> {
      await removeDownloadedFromDir(context, track, targetDir)

      // Файла больше нет — сбрасываем handle и переводим в remote-only.
      context.writer.updateTrackHandle(track.id, undefined)
      context.writer.updateTrackFileLocation(track.id, 'remote-only')
      const nextSource = track.remotePath ? service.buildDownloadUrl(track.remotePath) : ''
      context.writer.updateTrackSource(track.id, nextSource)
    },

    async scanDownloadDir(
      context: PluginContext,
      targetDir: FileSystemDirectoryHandle,
    ): Promise<ScanResult> {
      return scanDownloadDirForSource({ sourceId: id }, context, targetDir)
    },

    async createLocalTrack(
      context: PluginContext,
      relativePath: string,
      filename: string,
    ): Promise<LibraryTrack | null> {
      return createLocalTrackFromFile({ sourceId: id }, context, relativePath, filename)
    },

    async saveCache(context: PluginContext): Promise<void> {
      const collected = currentLibraryFromWriter(context, id)
      await yandexPersistenceService.save(id, toPersisted(collected))
    },

    async disconnect(context: PluginContext): Promise<void> {
      if (service.setCancelled) service.setCancelled(true)
      if (service.setDisconnected) service.setDisconnected(true)
      await yandexPersistenceService.clear(id)
      context.writer.removeBySource(id)
      if (service.logout) service.logout()
    },
  }
}
