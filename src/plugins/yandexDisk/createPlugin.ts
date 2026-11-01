// src/plugins/yandexDisk/createPlugin.ts

import type { LibrarySource, PluginContext, PluginSnapshot, ScanFolderOptions, ScanResult } from '../types';
import type { Track, TrackSource } from '@/types/track';
import type { FolderId } from '@/types/ids';
import { downloadTrackToDir, removeDownloadedFromDir } from './download';
import { createPluginStorage } from './storage';
import { authService } from '@/services/auth/AuthService';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { loadImpl } from './load';
import { scanFolderImpl, canForceScan } from './scanFolder';
import { ScanQueue } from './ScanQueue';
import { createTextFileMethods } from './textFiles';
import { restoreFromLocalFilesImpl } from './localRestore';
import type { IYandexService } from './types';

export interface YandexPluginOptions {
  id: string;
  name: string;
  icon: string;
  service: IYandexService;
}

interface ServiceWithSetConnected extends IYandexService {
  setConnected?(val: boolean): void;
}

function hasSetConnected(service: IYandexService): service is ServiceWithSetConnected {
  return typeof (service as ServiceWithSetConnected).setConnected === 'function';
}

export function createYandexPlugin({ id, name, icon, service }: YandexPluginOptions): LibrarySource {
  let cancelled = false;
  service.isCancelled = () => cancelled;
  service.setCancelled = (val: boolean) => {
    cancelled = val;
  };

  const storage = createPluginStorage(id);
  const isCancelled = () => cancelled;
  const textMethods = createTextFileMethods(id, service, storage);

  let scanQueue: ScanQueue | null = null;

  function getOrCreateQueue(context: PluginContext): ScanQueue {
    if (!scanQueue) {
      scanQueue = new ScanQueue({
        pluginId: id,
        service,
        storage,
        context,
        onLibraryUpdate: async (snapshot) => {
          await context.writer.setLibrary(snapshot, id);
        },
      });
    }
    return scanQueue;
  }

  const scanFolderBound = async (context: PluginContext, folderId: FolderId, options: ScanFolderOptions) => {
    await storage.load();
    return scanFolderImpl({ pluginId: id, service, storage }, context, folderId, options);
  };

  const plugin: LibrarySource = {
    id,
    name,
    icon,
    canDownload: true,
    isAvailable: () => typeof window !== 'undefined',
    isDisconnected: () => service.isDisconnected?.() ?? false,

    async checkSession(): Promise<'ok' | 'expired' | 'unavailable'> {
      if (!service.checkSession) return 'ok';
      return service.checkSession();
    },

    markDisconnected(): void {
      service.setDisconnected?.(true);
    },

    async connect(): Promise<void> {
      if (service.setDisconnected) service.setDisconnected(false);
      if (service.setCancelled) service.setCancelled(false);

      await storage.load();

      if (service.login) {
        const ok = await service.login();
        if (!ok) throw new Error('cancelled');
        return;
      }

      const alive = service.ping ? await service.ping() : true;
      if (!alive) throw new Error('Сервер недоступен');

      const me = await authService.me();
      if (me.authenticated) {
        if (hasSetConnected(service) && service.setConnected) {
          service.setConnected(true);
        }
        return;
      }

      authService.startOAuth();
      throw new Error('redirect');
    },

    async load(context, options) {
      await storage.load();
      return loadImpl(
        {
          pluginId: id,
          service,
          storage,
          isCancelled,
          scanFolderImpl: scanFolderBound,
          onPendingFolders: (folders) => {
            const queue = getOrCreateQueue(context);
            for (const f of folders) {
              queue.enqueue(f.id);
            }
          },
        },
        options,
      );
    },

    async restoreFromCache(): Promise<PluginSnapshot | null> {
      return null;
    },

    async restoreFromLocalFiles(context: PluginContext): Promise<PluginSnapshot | null> {
      return restoreFromLocalFilesImpl(id, context, storage);
    },

    async mergeLocalIntoLibrary(): Promise<PluginSnapshot | null> {
      return null;
    },

    scanFolder: scanFolderBound,

    canForceScan: (folderId: FolderId): boolean => canForceScan(folderId),

    buildStreamUrl(source: TrackSource): string {
      if (source.kind !== 'cloud') throw new Error(`[${id}] source must be cloud`);
      return service.buildDownloadUrl(source.remotePath);
    },

    buildDownloadUrl(track: Track, source: TrackSource): string {
      if (source.kind !== 'cloud') throw new Error(`[${id}] source must be cloud`);
      return service.buildDownloadUrl(source.remotePath);
    },

    async downloadTrack(context, track, source, options) {
      return downloadTrackToDir(
        { buildDownloadUrl: (t, s) => plugin.buildDownloadUrl!(t, s) },
        context,
        track,
        source,
        options,
      );
    },

    async removeDownloaded(context, track, source, targetDir) {
      await removeDownloadedFromDir(context, track, source, targetDir);
    },

    async scanDownloadDir(): Promise<ScanResult> {
      return { downloaded: new Map(), onlyLocal: [], missing: [] };
    },

    async createLocalTrack() {
      return null;
    },

    async saveCache(): Promise<void> {
      await storage.flush();
    },

    cancelBackgroundScan(): void {
      if (scanQueue) {
        scanQueue.cancelAll();
      }
      cancelled = true;
    },

    async disconnect(context: PluginContext): Promise<void> {
      if (scanQueue) {
        scanQueue.cancelAll();
        scanQueue = null;
      }
      if (service.setCancelled) service.setCancelled(true);
      if (service.setDisconnected) service.setDisconnected(true);
      context.writer.removeBySource(id);

      const cached = storage.getFoldersCache();
      if (cached) {
        folderStatusService.forgetMany(cached.map((f) => f.id));
      }

      await storage.clear();

      if (service.logout) service.logout();
    },

    // Текстовые файлы и файлы вообще (инкапсулированы в textFiles.ts)
    getTextFiles: textMethods.getTextFiles,
    readTextFile: textMethods.readTextFile,
    writeTextFile: textMethods.writeTextFile,
    buildFileUrl: textMethods.buildFileUrl,

    isScanning(): boolean {
      return scanQueue ? scanQueue.isRunning : false;
    },
  };

  return plugin;
}
