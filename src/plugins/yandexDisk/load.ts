// src/plugins/yandexDisk/load.ts

import type { PluginSnapshot, LoadOptions, PluginContext } from '../types';
import type { FolderId } from '@/types/ids';
import { newFolderId } from '@/types/ids';
import { scanAll, ROOT_REMOTE_PATH } from './scan';
import { buildFullPathMap, type PluginStorage } from './storage';
import type { IYandexService } from './types';
import { getPluginManifest } from '@/plugins/lookup';

export interface LoadDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
  onPendingFolders: (folders: PluginSnapshot['folders']) => void;
}

export async function loadImpl(deps: LoadDeps, context: PluginContext, options?: LoadOptions): Promise<PluginSnapshot> {
  const { pluginId, service, storage, onPendingFolders } = deps;
  const forceRefresh = options?.forceRefresh ?? false;
  const writer = context.writer;

  // Всегда дополняем pathMap из library — иначе прямые дети корня
  // не найдутся при следующем скане (recursive: false возвращает только корень).
  const basePathMap = buildFullPathMap(storage, writer, pluginId);
  storage.setPathMap(basePathMap);

  const currentPathMap = basePathMap;
  const cached = !forceRefresh ? storage.getFoldersCache() : null;
  if (cached && cached.length > 0) {
    const rootFolder = cached.find((f) => f.parentId === null);
    const root = rootFolder ? writer.getFolder(rootFolder.id) : null;

    if (root && root.scanState === 'scanned') {
      const pendingChildren: PluginSnapshot['folders'] = [];
      for (const f of cached) {
        if (f.parentId === null) continue;

        const dbFolder = writer.getFolder(f.id);
        if (!dbFolder) continue;

        if (dbFolder.scanState === 'pending' || dbFolder.scanState === 'error') {
          pendingChildren.push(f);
        }
      }

      if (pendingChildren.length > 0) {
        onPendingFolders(pendingChildren);
      }

      return { folders: cached, tracks: [] };
    }
  }

  const rootFolderId =
    // oxlint-disable-next-line no-unused-vars
    (Object.entries(currentPathMap).find(([_, p]) => p === ROOT_REMOTE_PATH)?.[0] as FolderId | undefined) ??
    newFolderId();

  const manifestName = getPluginManifest(pluginId)?.name ?? 'Корень';
  writer.setFolderScanState(rootFolderId, 'scanning', { progress: { done: 0, total: 0 } });

  const { snapshot, pathMap } = await scanAll(pluginId, service, currentPathMap, rootFolderId, ROOT_REMOTE_PATH, {
    recursive: false,
    skipScanned: true,
    startFolderName: manifestName,
    isFolderScanned: (id) => writer.getFolder(id)?.scanState === 'scanned',
  });

  storage.setPathMap({ ...currentPathMap, ...pathMap });

  const rootFolder = {
    id: rootFolderId,
    parentId: null,
    name: manifestName,
    urlPath: '',
    files: [],
  };

  const childFolders = snapshot.folders.filter((f) => f.id !== rootFolderId);

  const fullFolders = [rootFolder, ...childFolders];
  storage.setFoldersCache(storage.mergeFoldersCache(cached ?? [], fullFolders));

  await writer.setLibrary({ ...snapshot, folders: fullFolders }, pluginId);

  writer.setFolderScanState(rootFolderId, 'scanned');

  const pendingChildren: PluginSnapshot['folders'] = [];
  for (const f of fullFolders) {
    if (f.parentId === null) continue;
    const dbFolder = writer.getFolder(f.id);
    if (dbFolder && (dbFolder.scanState === 'pending' || dbFolder.scanState === 'error')) {
      pendingChildren.push(f);
    }
  }

  if (pendingChildren.length > 0) {
    onPendingFolders(pendingChildren);
  }

  return { ...snapshot, folders: fullFolders };
}
