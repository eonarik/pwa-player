// src/plugins/yandexDisk/ScanQueue.ts

import type { FolderId } from '@/types/ids';
import type { PluginContext, PluginSnapshot } from '../types';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import { scanAll } from './scan';
import { makeProgress, markScanningParents, updateParentsStatus } from './helpers';
import type { IYandexService } from './types';
import type { PluginStorage } from './storage';
import { applyLocalMatchesForFolders } from './localMatches';

export interface ScanQueueDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
  context: PluginContext;
  onLibraryUpdate: (snapshot: PluginSnapshot) => Promise<void>;
}

export class ScanQueue {
  private queue = new Set<FolderId>();
  private processingSet = new Set<FolderId>();

  private isProcessing = false;
  private abortController: AbortController | null = null;
  private activeFolderId: FolderId | null = null;

  constructor(private deps: ScanQueueDeps) {}

  enqueue(folderId: FolderId): void {
    if (folderStatusService.isScanned(folderId)) return;
    if (folderStatusService.isScanning(folderId)) return;
    if (this.queue.has(folderId) || this.processingSet.has(folderId)) return;

    folderStatusService.markPending(folderId);
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

    const errorIds = [...pendingIds, ...Array.from(this.processingSet)];
    this.processingSet.clear();
    this.activeFolderId = null;

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

        if (this.processingSet.has(folderId)) continue;
        if (folderStatusService.isScanned(folderId)) continue;
        if (folderStatusService.isScanning(folderId)) continue;

        this.processingSet.add(folderId);
        this.activeFolderId = folderId;

        let remotePath = this.deps.storage.getPathMap()[folderId];

        // Защита: если путь потерян, восстанавливаем его из library
        if (!remotePath) {
          const libFolder = this.deps.context.writer.getFolder(folderId);
          if (libFolder && libFolder.urlPath !== undefined) {
            remotePath = libFolder.urlPath ? `disk:/${libFolder.urlPath}` : 'disk:/';
            this.deps.storage.setPathMap({ ...this.deps.storage.getPathMap(), [folderId]: remotePath });
          }
        }

        if (!remotePath) {
          folderStatusService.markError(folderId, 'Путь не найден (требуется пересинхронизация)');
          this.processingSet.delete(folderId);
          this.activeFolderId = null;
          continue;
        }

        const cachedFolders = this.deps.storage.getFoldersCache() ?? [];
        const currentFolder = cachedFolders.find((f) => f.id === folderId);

        try {
          markScanningParents(folderId, cachedFolders);
          folderStatusService.markScanning(folderId, { done: 0, total: 0 });

          const baseProgress = makeProgress();
          let progressDone = 0;
          let progressTotal = 0;

          const progress = {
            ...baseProgress,
            onStart: (id: FolderId) => {
              baseProgress.onStart(id);
            },
            onDone: (id: FolderId) => {
              baseProgress.onDone(id);
              if (id !== folderId) {
                progressDone++;
                folderStatusService.updateProgress(folderId, { done: progressDone, total: progressTotal });
              }
            },
            onError: (id: FolderId, err: unknown) => {
              baseProgress.onError(id, err);
              if (id !== folderId) {
                progressDone++;
                folderStatusService.updateProgress(folderId, { done: progressDone, total: progressTotal });
              }
            },
            onFolderDiscovered: (_folder: PluginSnapshot['folders'][number]) => {
              progressTotal++;
              folderStatusService.updateProgress(folderId, { done: progressDone, total: progressTotal });
            },
            onChunk: async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
              await this.deps.onLibraryUpdate({ folders, tracks });
              await applyLocalMatchesForFolders(this.deps.pluginId, this.deps.context, folders);
            },
          };

          const {
            snapshot,
            newFolderMap,
            pathMap: newPaths,
          } = await scanAll(
            this.deps.pluginId,
            this.deps.service,
            this.deps.storage.getPathMap(),
            folderId,
            remotePath,
            {
              recursive: true,
              skipScanned: true,
              progress,
              startFolderName: currentFolder?.name,
              startParentId: currentFolder?.parentId ?? null,
            },
          );

          if (this.abortController.signal.aborted) break;

          this.deps.storage.setPathMap({ ...this.deps.storage.getPathMap(), ...newFolderMap, ...newPaths });
          this.deps.storage.setFoldersCache(
            this.deps.storage.mergeFoldersCache(this.deps.storage.getFoldersCache() ?? [], snapshot.folders),
          );

          for (const f of snapshot.folders) {
            if (folderStatusService.isError(f.id)) continue;
            folderStatusService.markScanned(f.id);
          }

          await this.deps.onLibraryUpdate(snapshot);

          const foldersToMatch = currentFolder ? [currentFolder, ...snapshot.folders] : snapshot.folders;
          await applyLocalMatchesForFolders(this.deps.pluginId, this.deps.context, foldersToMatch);

          if (!folderStatusService.isError(folderId)) {
            folderStatusService.markScanned(folderId);
          }
          updateParentsStatus(folderId, this.deps.storage.getFoldersCache() ?? []);
        } catch (err) {
          if (this.abortController.signal.aborted) {
            break;
          }
          const reason = err instanceof Error ? err.message : 'Ошибка синхронизации';
          folderStatusService.markError(folderId, reason);
          updateParentsStatus(folderId, cachedFolders);
        } finally {
          this.processingSet.delete(folderId);
          this.activeFolderId = null;
        }
      }
    } finally {
      this.isProcessing = false;
      this.abortController = null;
    }
  }
}
