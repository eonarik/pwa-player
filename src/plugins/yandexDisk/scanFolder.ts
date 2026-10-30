// src/plugins/yandexDisk/scanFolder.ts

import type { PluginContext, PluginSnapshot, ScanFolderOptions } from '../types';
import type { FolderId } from '@/types/ids';
import { scanAll } from './scan';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { PluginStorage } from './storage';
import type { IYandexService } from './types';
import { makeProgress, registerFolders, markScanningParents, updateParentsStatus } from './helpers';

export interface ScanFolderDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
}

export async function scanFolderImpl(
  deps: ScanFolderDeps,
  context: PluginContext,
  folderId: FolderId,
  options: ScanFolderOptions,
): Promise<PluginSnapshot> {
  const { pluginId, service, storage } = deps;
  const pathMap = storage.getPathMap();
  const remotePath = pathMap[folderId];

  if (!remotePath) {
    throw new Error(`[${pluginId}] path for folder "${folderId}" not found`);
  }

  const cachedFolders = storage.getFoldersCache() ?? [];

  console.log(`[${pluginId}] Scanning folder: ${remotePath} (recursive: ${options.recursive})`);

  markScanningParents(folderId, cachedFolders);

  try {
    const baseProgress = makeProgress();
    const progress = {
      ...baseProgress,
      onChunk: async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
        // Сразу отдаем в UI
        await context.writer.setLibrary({ folders, tracks }, pluginId);
      },
    };

    const {
      snapshot,
      newFolderMap,
      pathMap: newPaths,
    } = await scanAll(pluginId, service, pathMap, folderId, remotePath, { recursive: options.recursive, progress });

    storage.setPathMap({ ...pathMap, ...newFolderMap, ...newPaths });

    const scannedSet = new Set<FolderId>();
    if (options.recursive) {
      for (const f of snapshot.folders) scannedSet.add(f.id);
    } else {
      scannedSet.add(folderId);
    }
    registerFolders(snapshot.folders, scannedSet);

    storage.setFoldersCache(storage.mergeFoldersCache(storage.getFoldersCache() ?? [], snapshot.folders));

    // На случай, если нужно обновить оставшееся
    await context.writer.setLibrary(snapshot, pluginId);

    updateParentsStatus(folderId, storage.getFoldersCache() ?? []);

    return snapshot;
  } catch (err) {
    folderStatusService.markError(folderId, 'Scan failed');
    updateParentsStatus(folderId, cachedFolders);
    throw err;
  }
}
