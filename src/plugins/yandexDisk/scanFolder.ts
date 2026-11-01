// src/plugins/yandexDisk/scanFolder.ts

import type { PluginContext, PluginSnapshot, ScanFolderOptions } from '../types';
import type { FolderId } from '@/types/ids';
import { scanAll } from './scan';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { PluginStorage } from './storage';
import type { IYandexService } from './types';
import { makeProgress, registerFolders, markScanningParents, updateParentsStatus } from './helpers';
import { applyLocalMatchesForFolders } from './localMatches';

export interface ScanFolderDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
}

/**
 * Проверяет, идёт ли скан для папки (она `scanning`) — force scan недоступен.
 */
export function canForceScan(folderId: FolderId): boolean {
  return !folderStatusService.isScanning(folderId);
}

/**
 * Собирает все ID папок в поддереве `folderId` (по `library.folders`).
 * Используется для гибридной чистки при force scan.
 */
function collectSubtreeIds(context: PluginContext, folderId: FolderId): Set<FolderId> {
  const allFolders = context.writer.getFoldersBySource(context.writer.getFolder(folderId)?.pluginId ?? '');
  const byParent = new Map<FolderId, FolderId[]>();
  for (const f of allFolders) {
    if (f.parentId) {
      const list = byParent.get(f.parentId) ?? [];
      list.push(f.id);
      byParent.set(f.parentId, list);
    }
  }

  const result = new Set<FolderId>([folderId]);
  const stack: FolderId[] = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const childId of byParent.get(id) ?? []) {
      if (result.has(childId)) continue;
      result.add(childId);
      stack.push(childId);
    }
  }
  return result;
}

export async function scanFolderImpl(
  deps: ScanFolderDeps,
  context: PluginContext,
  folderId: FolderId,
  options: ScanFolderOptions,
): Promise<PluginSnapshot> {
  const { pluginId, service, storage } = deps;

  let remotePath = storage.getPathMap()[folderId];

  // Если пути нет в pathMap (например, папка была восстановлена локально
  // или pathMap сбросился), пробуем восстановить его из library по urlPath.
  if (!remotePath) {
    const libFolder = context.writer.getFolder(folderId);
    if (libFolder && libFolder.urlPath !== undefined) {
      remotePath = libFolder.urlPath ? `disk:/${libFolder.urlPath}` : 'disk:/';
      storage.setPathMap({ ...storage.getPathMap(), [folderId]: remotePath });
    }
  }

  if (!remotePath) {
    folderStatusService.markError(folderId, 'Путь не найден (требуется пересинхронизация)');
    throw new Error(`[${pluginId}] path for folder "${folderId}" not found`);
  }

  const isForce = options.force === true;

  if (isForce && folderStatusService.isScanning(folderId)) {
    console.warn(`[${pluginId}] force scan skipped: folder "${folderId}" is already scanning`);
    return { folders: [], tracks: [] };
  }

  // Сбрасываем флаг отмены, если пользователь явно запускает force scan
  if (isForce && service.setCancelled) {
    service.setCancelled(false);
  }

  const cachedFolders = storage.getFoldersCache() ?? [];
  const currentFolder = cachedFolders.find((f) => f.id === folderId);

  console.log(`[${pluginId}] Scanning folder: ${remotePath} (recursive: ${options.recursive}, force: ${isForce})`);

  markScanningParents(folderId, cachedFolders);
  folderStatusService.markScanning(folderId, { done: 0, total: 0 });

  let progressDone = 0;
  let progressTotal = 0;

  const reportProgress = (): void => {
    folderStatusService.updateProgress(folderId, { done: progressDone, total: progressTotal });
  };

  try {
    const baseProgress = makeProgress();
    const progress = {
      ...baseProgress,
      onStart: (id: FolderId) => {
        baseProgress.onStart(id);
      },
      onDone: (id: FolderId) => {
        baseProgress.onDone(id);
        if (id !== folderId) {
          progressDone++;
          reportProgress();
        }
      },
      onError: (id: FolderId, err: unknown) => {
        baseProgress.onError(id, err);
        if (id !== folderId) {
          progressDone++;
          reportProgress();
        }
      },
      onFolderDiscovered: (folder: PluginSnapshot['folders'][number]) => {
        progressTotal++;
        reportProgress();
        void folder;
      },
      onChunk: async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
        await context.writer.setLibrary({ folders, tracks }, pluginId);
        await applyLocalMatchesForFolders(pluginId, context, folders);
      },
    };

    const {
      snapshot,
      newFolderMap,
      pathMap: newPaths,
    } = await scanAll(pluginId, service, storage.getPathMap(), folderId, remotePath, {
      recursive: options.recursive,
      skipScanned: !isForce,
      progress,
      // Передаем имя и родителя стартовой папки
      startFolderName: currentFolder?.name,
      startParentId: currentFolder?.parentId ?? null,
    });

    storage.setPathMap({ ...storage.getPathMap(), ...newFolderMap, ...newPaths });

    const scannedSet = new Set<FolderId>();
    if (options.recursive) {
      for (const f of snapshot.folders) scannedSet.add(f.id);
    } else {
      scannedSet.add(folderId);
    }
    scannedSet.add(folderId);

    registerFolders(snapshot.folders, scannedSet);
    storage.setFoldersCache(storage.mergeFoldersCache(storage.getFoldersCache() ?? [], snapshot.folders));

    await context.writer.setLibrary(snapshot, pluginId);

    if (isForce) {
      const subtreeIds = collectSubtreeIds(context, folderId);
      context.writer.cleanupForceScan(subtreeIds, snapshot);
      context.writer.cleanupOrphanAlbums();
    }

    const foldersToMatch = currentFolder ? [currentFolder, ...snapshot.folders] : snapshot.folders;
    await applyLocalMatchesForFolders(pluginId, context, foldersToMatch);

    folderStatusService.markScanned(folderId);
    updateParentsStatus(folderId, storage.getFoldersCache() ?? []);

    return snapshot;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Ошибка сканирования';
    folderStatusService.markError(folderId, reason);
    updateParentsStatus(folderId, cachedFolders);
    throw err;
  }
}
