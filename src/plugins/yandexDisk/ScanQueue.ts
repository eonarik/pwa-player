// src/plugins/yandexDisk/ScanQueue.ts

import { ref, type Ref } from 'vue';
import type { FolderId } from '@/types/ids';
import type { PluginContext, PluginFolderPayload, PluginSnapshot } from '../types';
import { scanAll } from './scan';
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

  /**
   * Реактивный флаг: очередь не пуста или сейчас выполняется скан.
   * Используется UI (FolderView/FolderSyncMenu) для индикатора.
   */
  readonly isRunning: Ref<boolean> = ref(false);

  constructor(private deps: ScanQueueDeps) {}

  enqueue(folderId: FolderId): void {
    const writer = this.deps.context.writer;
    const folder = writer.getFolder(folderId);
    if (!folder) return;

    if (folder.scanState === 'scanned') return;
    if (folder.scanState === 'scanning') return;
    if (this.queue.has(folderId) || this.processingSet.has(folderId)) return;

    writer.setFolderScanState(folderId, 'pending');
    this.queue.add(folderId);
    this.isRunning.value = true;
    this.processNext();
  }

  dequeue(folderId: FolderId): void {
    this.queue.delete(folderId);
    if (this.queue.size === 0 && !this.isProcessing) {
      this.isRunning.value = false;
    }
  }

  cancelAll(): void {
    const writer = this.deps.context.writer;
    const pendingIds = Array.from(this.queue);
    this.queue.clear();

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const errorIds = [...pendingIds, ...Array.from(this.processingSet)];
    this.processingSet.clear();

    for (const id of errorIds) {
      writer.setFolderScanState(id, 'error', { error: 'Отмена синхронизации' });
    }

    this.isProcessing = false;
    this.isRunning.value = false;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.size === 0) {
      if (!this.isProcessing && this.queue.size === 0) {
        this.isRunning.value = false;
      }
      return;
    }

    this.isProcessing = true;
    this.isRunning.value = true;

    const localAbort = new AbortController();
    this.abortController = localAbort;

    if (this.deps.service.setCancelled) {
      this.deps.service.setCancelled(false);
    }

    const writer = this.deps.context.writer;

    try {
      while (this.queue.size > 0 && !localAbort.signal.aborted) {
        const folderId = this.queue.values().next().value as FolderId;
        this.queue.delete(folderId);

        if (this.processingSet.has(folderId)) continue;

        const folder = writer.getFolder(folderId);
        if (!folder) continue;
        if (folder.scanState === 'scanned') continue;
        if (folder.scanState === 'scanning') continue;

        this.processingSet.add(folderId);

        let remotePath = this.deps.storage.getPathMap()[folderId];

        if (!remotePath) {
          if (folder.urlPath !== undefined) {
            remotePath = folder.urlPath ? folder.urlPath : '/';
            this.deps.storage.setPathMap({ ...this.deps.storage.getPathMap(), [folderId]: remotePath });
          }
        }

        if (!remotePath) {
          writer.setFolderScanState(folderId, 'error', { error: 'Путь не найден' });
          this.processingSet.delete(folderId);
          continue;
        }
        writer.setFolderScanState(folderId, 'scanning', { progress: { done: 0, total: 0 } });
        this.markScanningParents(folderId);

        try {
          let progressDone = 0;
          let progressTotal = 0;

          const progress = {
            onStart: (id: FolderId) => {
              if (id !== folderId) {
                const f = writer.getFolder(id);
                if (f && f.scanState === 'pending') {
                  writer.setFolderScanState(id, 'scanning');
                }
              }
            },
            onDone: (id: FolderId) => {
              if (id !== folderId) {
                const f = writer.getFolder(id);
                if (f && f.scanState !== 'error') {
                  writer.setFolderScanState(id, 'scanned');
                }
                progressDone++;
                writer.updateFolderScanProgress(folderId, { done: progressDone, total: progressTotal });
              }
            },
            onError: (id: FolderId) => {
              if (id !== folderId) {
                writer.setFolderScanState(id, 'error', { error: 'Scan failed' });
                progressDone++;
                writer.updateFolderScanProgress(folderId, { done: progressDone, total: progressTotal });
              }
            },
            onFolderDiscovered: (folder: PluginFolderPayload) => {
              if (folder.id !== folderId) {
                void writer.setLibrary({ folders: [folder], tracks: [] }, this.deps.pluginId);
              }
              progressTotal++;
              writer.updateFolderScanProgress(folderId, { done: progressDone, total: progressTotal });
            },
            onChunk: async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
              await this.deps.onLibraryUpdate({ folders, tracks });
              await applyLocalMatchesForFolders(this.deps.pluginId, this.deps.context, folders);
            },
          };

          const { snapshot, pathMap: newPaths } = await scanAll(
            this.deps.pluginId,
            this.deps.service,
            this.deps.storage.getPathMap(),
            folderId,
            remotePath,
            {
              recursive: true,
              skipScanned: true,
              progress,
              startFolderName: folder.name,
              startParentId: folder.parentId ?? null,
              isFolderScanned: (id) => this.isFolderScanned(id),
            },
          );

          if (localAbort.signal.aborted) break;

          this.deps.storage.setPathMap({ ...this.deps.storage.getPathMap(), ...newPaths });
          this.deps.storage.setFoldersCache(
            this.deps.storage.mergeFoldersCache(this.deps.storage.getFoldersCache() ?? [], snapshot.folders),
          );

          for (const f of snapshot.folders) {
            const currentState = writer.getFolder(f.id)?.scanState;
            if (f.scanState === 'error') {
              writer.setFolderScanState(f.id, 'error', { error: 'Scan failed' });
            } else if (currentState !== 'error') {
              writer.setFolderScanState(f.id, 'scanned');
            }
          }

          await this.deps.onLibraryUpdate(snapshot);

          const foldersToMatch = [folder, ...snapshot.folders];
          await applyLocalMatchesForFolders(this.deps.pluginId, this.deps.context, foldersToMatch);

          const currentState = writer.getFolder(folderId)?.scanState;
          if (currentState !== 'error') {
            writer.setFolderScanState(folderId, 'scanned');
          }

          this.updateParentsStatus(folderId);
        } catch (err) {
          if (localAbort.signal.aborted) {
            break;
          }
          const reason = err instanceof Error ? err.message : 'Ошибка синхронизации';
          writer.setFolderScanState(folderId, 'error', { error: reason });
          this.updateParentsStatus(folderId);
        } finally {
          this.processingSet.delete(folderId);
        }
      }
    } finally {
      this.isProcessing = false;
      if (this.abortController === localAbort) {
        this.abortController = null;
      }
      if (this.queue.size > 0) {
        this.processNext();
      } else {
        this.isRunning.value = false;
      }
    }
  }

  private isFolderScanned(folderId: FolderId): boolean {
    return this.deps.context.writer.getFolder(folderId)?.scanState === 'scanned';
  }

  private markScanningParents(folderId: FolderId): void {
    const writer = this.deps.context.writer;
    const allFolders = writer.getFoldersBySource(this.deps.pluginId);

    let parentId = allFolders.find((f) => f.id === folderId)?.parentId;
    while (parentId) {
      const parent = writer.getFolder(parentId);
      if (!parent) break;
      if (parent.scanState !== 'scanning') {
        writer.setFolderScanState(parentId, 'scanning', { progress: parent.scanProgress });
      }
      parentId = parent.parentId;
    }
  }

  private updateParentsStatus(folderId: FolderId): void {
    const writer = this.deps.context.writer;
    const allFolders = writer.getFoldersBySource(this.deps.pluginId);

    let parentId = allFolders.find((f) => f.id === folderId)?.parentId;
    while (parentId) {
      const children = allFolders.filter((f) => f.parentId === parentId);

      let hasScanning = false;
      let hasPending = false;

      for (const c of children) {
        const childFolder = writer.getFolder(c.id);
        if (!childFolder) continue;
        if (childFolder.scanState === 'scanning') hasScanning = true;
        else if (childFolder.scanState === 'pending') hasPending = true;
      }

      if (hasScanning || hasPending) {
        writer.setFolderScanState(parentId, 'scanning');
      } else {
        writer.setFolderScanState(parentId, 'scanned');
      }

      parentId = allFolders.find((f) => f.id === parentId)?.parentId;
    }
  }
}
