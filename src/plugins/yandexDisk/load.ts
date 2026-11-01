// src/plugins/yandexDisk/load.ts

import type { PluginSnapshot, LoadOptions, PluginContext, ScanFolderOptions } from '../types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { scanAll, ROOT_REMOTE_PATH } from './scan';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { PluginStorage } from './storage';
import type { IYandexService } from './types';
import { makeProgress, registerFolders } from './helpers';

export interface LoadDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
  isCancelled: () => boolean;
  scanFolderImpl: (context: PluginContext, folderId: FolderId, options: ScanFolderOptions) => Promise<PluginSnapshot>;
  onPendingFolders: (folders: PluginSnapshot['folders']) => void;
}

export async function loadImpl(deps: LoadDeps, options?: LoadOptions): Promise<PluginSnapshot> {
  const { pluginId, service, storage, onPendingFolders } = deps;
  const forceRefresh = options?.forceRefresh ?? false;

  const currentPathMap = storage.getPathMap();
  const cached = !forceRefresh ? storage.getFoldersCache() : null;

  // --- Ветка 1: кеш есть, корень scanned ---
  if (cached) {
    const rootFolder = cached.find((f) => f.parentId === null);
    const rootIsScanned = rootFolder ? folderStatusService.isScanned(rootFolder.id) : false;

    if (rootIsScanned) {
      console.info(`[${pluginId}] load: using folders cache (root scanned)`);

      // enqueue только pending/error детей. Сканы не запускаем.
      const pendingChildren: PluginSnapshot['folders'] = [];
      for (const f of cached) {
        if (f.parentId === null) continue;
        if (!currentPathMap[f.id]) {
          // Путь неизвестен — помечаем error (требуется пересинхронизация).
          if (folderStatusService.getStatus(f.id) === null) {
            folderStatusService.register(f.id, 'error');
          }
          continue;
        }
        if (folderStatusService.needsScan(f.id) || folderStatusService.isError(f.id)) {
          pendingChildren.push(f);
        } else if (folderStatusService.getStatus(f.id) === null) {
          folderStatusService.register(f.id, 'pending');
          pendingChildren.push(f);
        }
      }

      if (pendingChildren.length > 0) {
        onPendingFolders(pendingChildren);
      }

      return { folders: cached, tracks: [] };
    }
  }

  // --- Ветка 2/3: кеша нет или корень не scanned ---
  const rootFolderId = currentPathMap[ROOT_REMOTE_PATH]
    ? (currentPathMap[ROOT_REMOTE_PATH] as FolderId)
    : newFolderId();

  console.info(`[${pluginId}] load: fetching root from API`);
  folderStatusService.markScanning(rootFolderId, { done: 0, total: 0 });

  const { snapshot, newFolderMap, pathMap } = await scanAll(
    pluginId,
    service,
    currentPathMap,
    rootFolderId,
    ROOT_REMOTE_PATH,
    { recursive: false, skipScanned: true, progress: makeProgress() },
  );

  storage.setPathMap({ ...currentPathMap, ...newFolderMap, ...pathMap });

  const rootFolder = {
    id: rootFolderId,
    parentId: null,
    name: 'Яндекс.Диск',
    urlPath: '',
  };

  const fullFolders = [rootFolder, ...snapshot.folders];

  // Мержим кеш (не перезаписываем — глубокие папки из старого кеша могли сохраниться).
  storage.setFoldersCache(storage.mergeFoldersCache(cached ?? [], fullFolders));

  registerFolders(fullFolders, new Set([rootFolderId]));
  folderStatusService.markScanned(rootFolderId);

  // enqueue только pending/error детей (не scanned).
  const pendingChildren: PluginSnapshot['folders'] = [];
  for (const f of fullFolders) {
    if (f.parentId === null) continue;
    if (folderStatusService.needsScan(f.id) || folderStatusService.isError(f.id)) {
      pendingChildren.push(f);
    }
  }

  if (pendingChildren.length > 0) {
    onPendingFolders(pendingChildren);
  }

  return { ...snapshot, folders: fullFolders };
}
