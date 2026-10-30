// src/plugins/yandexDisk/ScanQueue.ts

import type { FolderId } from '@/types/ids';
import type { PluginContext, PluginSnapshot } from '../types';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { scanAll } from './scan';
import { makeProgress, markScanningParents, updateParentsStatus } from './helpers';
import type { IYandexService } from './types';
import type { PluginStorage } from './storage';

export interface ScanQueueDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
  context: PluginContext;
  onLibraryUpdate: (snapshot: PluginSnapshot) => Promise<void>;
}

export class ScanQueue {
  private queue = new Set<FolderId>();
  private isProcessing = false;
  private abortController: AbortController | null = null;
  private activeFolderId: FolderId | null = null;

  constructor(private deps: ScanQueueDeps) {}

  enqueue(folderId: FolderId): void {
    this.queue.add(folderId);
    this.processNext();
  }

  dequeue(folderId: FolderId): void {
    this.queue.delete(folderId);
  }

  get isRunning(): boolean {
    return this.isProcessing || this.queue.size > 0;
  }

  cancelAll(): void {
    const pendingIds = Array.from(this.queue);
    this.queue.clear();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const errorIds = [...pendingIds];
    if (this.activeFolderId) {
      errorIds.push(this.activeFolderId);
      this.activeFolderId = null;
    }

    if (errorIds.length > 0) {
      folderStatusService.markErrorMany(errorIds, 'Отмена синхронизации');
    }

    this.isProcessing = false;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) return;

    this.isProcessing = true;
    this.abortController = new AbortController();

    try {
      while (this.queue.size > 0 && !this.abortController.signal.aborted) {
        const folderId = this.queue.values().next().value as FolderId;
        this.queue.delete(folderId);

        this.activeFolderId = folderId;
        const pathMap = this.deps.storage.getPathMap();
        const remotePath = pathMap[folderId];

        if (!remotePath) {
          folderStatusService.markError(folderId, 'Path not found');
          this.activeFolderId = null;
          continue;
        }

        const cachedFolders = this.deps.storage.getFoldersCache() ?? [];

        try {
          markScanningParents(folderId, cachedFolders);

          console.log(`[YandexPlugin] Background scanning: ${remotePath}`);

          const baseProgress = makeProgress();
          const progress = {
            ...baseProgress,
            onChunk: async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
              // Сразу отдаем кусок в UI, чтобы обновить библиотеку
              await this.deps.onLibraryUpdate({ folders, tracks });
            },
          };

          const {
            snapshot,
            newFolderMap,
            pathMap: newPaths,
          } = await scanAll(this.deps.pluginId, this.deps.service, pathMap, folderId, remotePath, {
            recursive: true,
            progress,
          });

          if (this.abortController.signal.aborted) break;

          this.deps.storage.setPathMap({ ...pathMap, ...newFolderMap, ...newPaths });

          this.deps.storage.setFoldersCache(
            this.deps.storage.mergeFoldersCache(this.deps.storage.getFoldersCache() ?? [], snapshot.folders),
          );

          for (const f of snapshot.folders) {
            folderStatusService.register(f.id, 'scanned');
          }

          // На случай, если onChunk не вызвался (например, папка пустая)
          await this.deps.onLibraryUpdate(snapshot);

          folderStatusService.markScanned(folderId);
          updateParentsStatus(folderId, this.deps.storage.getFoldersCache() ?? []);
        } catch {
          if (this.abortController.signal.aborted) {
            break;
          }
          folderStatusService.markError(folderId, 'Ошибка синхронизации');
          updateParentsStatus(folderId, cachedFolders);
        } finally {
          this.activeFolderId = null;
        }
      }
    } finally {
      this.isProcessing = false;
      this.abortController = null;
    }
  }
}
