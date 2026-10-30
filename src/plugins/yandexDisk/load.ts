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
  // Заменяем any на реальные типы
  scanFolderImpl: (context: PluginContext, folderId: FolderId, options: ScanFolderOptions) => Promise<PluginSnapshot>;
  onPendingFolders: (folders: PluginSnapshot['folders']) => void;
}

export async function loadImpl(deps: LoadDeps, options?: LoadOptions): Promise<PluginSnapshot> {
  const { pluginId, service, storage, onPendingFolders } = deps;
  const forceRefresh = options?.forceRefresh ?? false;

  // --- Путь 1: кеш папок ---------------------------------------------
  if (!forceRefresh) {
    const cached = storage.getFoldersCache();
    if (cached) {
      console.info(`[${pluginId}] load: using folders cache`);

      const pendingChildren: PluginSnapshot['folders'] = [];

      for (const f of cached) {
        if (folderStatusService.getStatus(f.id) !== null) continue;
        if (f.parentId === null) {
          folderStatusService.register(f.id, 'scanned');
        } else {
          folderStatusService.register(f.id, 'pending');
          pendingChildren.push(f);
        }
      }

      if (pendingChildren.length > 0) {
        onPendingFolders(pendingChildren);
      }

      // Возвращаем только папки. Треки восстанавливаются из libraryStore.
      return { folders: cached, tracks: [] };
    }
  }

  // --- Путь 2: первичная загрузка (кеша нет или forceRefresh) --------
  const currentPathMap = storage.getPathMap();
  const rootFolderId = currentPathMap[ROOT_REMOTE_PATH]
    ? (currentPathMap[ROOT_REMOTE_PATH] as FolderId)
    : newFolderId();

  console.info(`[${pluginId}] load: fetching root from API`);
  folderStatusService.register(rootFolderId, 'scanning');

  const { snapshot, newFolderMap, pathMap } = await scanAll(
    pluginId,
    service,
    currentPathMap,
    rootFolderId,
    ROOT_REMOTE_PATH,
    { recursive: false, progress: makeProgress() },
  );

  storage.setPathMap({ ...currentPathMap, ...newFolderMap, ...pathMap });

  // ВАЖНО: scanAll вернул только детей корня (music, root_track).
  // Нам нужно вручную добавить сам корень в snapshot.folders.
  const rootFolder = {
    id: rootFolderId,
    parentId: null,
    name: 'Яндекс.Диск', // Корень всегда называется так в UI
    urlPath: '',
  };

  const fullFolders = [rootFolder, ...snapshot.folders];
  storage.setFoldersCache(fullFolders);

  registerFolders(fullFolders, new Set([rootFolderId]));

  const pendingChildren = fullFolders.filter((f) => f.parentId !== null);
  if (pendingChildren.length > 0) {
    onPendingFolders(pendingChildren);
  }

  return { ...snapshot, folders: fullFolders };
}
