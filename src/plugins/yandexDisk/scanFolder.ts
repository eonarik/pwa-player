// src/plugins/yandexDisk/scanFolder.ts

import type { PluginContext, PluginSnapshot, ScanFolderOptions } from '../types';
import type { FolderId } from '@/types/ids';
import type { LibraryWriter } from '@/services/library/LibraryWriter';
import { scanAll } from './scan';
import type { PluginStorage } from './storage';
import type { IYandexService } from './types';
import { applyLocalMatchesForFolders } from './localMatches';
import { getPluginManifest } from '@/plugins/lookup';

export interface ScanFolderDeps {
  pluginId: string;
  service: IYandexService;
  storage: PluginStorage;
}

export function canForceScan(folderId: FolderId, writer: LibraryWriter): boolean {
  const folder = writer.getFolder(folderId);
  return folder?.scanState !== 'scanning';
}

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
  const writer = context.writer;

  let remotePath = storage.getPathMap()[folderId];

  if (!remotePath) {
    const libFolder = writer.getFolder(folderId);
    if (libFolder && libFolder.urlPath !== undefined) {
      // urlPath — без 'disk:/' (может быть '' для корня).
      // scanAll сам нормализует в '/...'.
      remotePath = libFolder.urlPath ? libFolder.urlPath : '/';
      storage.setPathMap({ ...storage.getPathMap(), [folderId]: remotePath });
    }
  }

  if (!remotePath) {
    writer.setFolderScanState(folderId, 'error', { error: 'Путь не найден' });
    throw new Error(`[${pluginId}] path for folder "${folderId}" not found`);
  }

  const isForce = options.force === true;

  if (isForce) {
    const folder = writer.getFolder(folderId);
    if (folder?.scanState === 'scanning') {
      console.warn(`[${pluginId}] force scan skipped: folder "${folderId}" is already scanning`);
      return { folders: [], tracks: [] };
    }
    if (service.setCancelled) {
      service.setCancelled(false);
    }
  }
  const folder = writer.getFolder(folderId);
  const startFolderName =
    folder?.name ?? (remotePath === '/' ? (getPluginManifest(pluginId)?.name ?? 'Корень') : undefined);

  writer.setFolderScanState(folderId, 'scanning', { progress: { done: 0, total: 0 } });

  let progressDone = 0;
  let progressTotal = 0;

  try {
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
      onFolderDiscovered: () => {
        progressTotal++;
        writer.updateFolderScanProgress(folderId, { done: progressDone, total: progressTotal });
      },
      // При force scan — не отдаём чанки в UI, чтобы не было промежуточного
      // состояния (старая + новая папка). Всё применяется атомарно в финальном setLibrary.
      onChunk: isForce
        ? undefined
        : async (folders: PluginSnapshot['folders'], tracks: PluginSnapshot['tracks']) => {
            await writer.setLibrary({ folders, tracks }, pluginId);
            await applyLocalMatchesForFolders(pluginId, context, folders);
          },
    };

    const { snapshot, pathMap: newPaths } = await scanAll(
      pluginId,
      service,
      storage.getPathMap(),
      folderId,
      remotePath,
      {
        recursive: options.recursive,
        skipScanned: !isForce,
        progress,
        startFolderName,
        startParentId: folder?.parentId ?? null,
        isFolderScanned: (id) => writer.getFolder(id)?.scanState === 'scanned',
      },
    );

    // Не подмешиваем newFolderMap (remotePath → folderId) в storage.pathMap.
    storage.setPathMap({ ...storage.getPathMap(), ...newPaths });

    await writer.setLibrary(snapshot, pluginId, {
      cleanupSubtree: isForce ? collectSubtreeIds(context, folderId) : undefined,
    });

    // cleanupOrphanAlbums — после всех мутаций, sync.
    if (isForce) {
      writer.cleanupOrphanAlbums();
    }

    for (const f of snapshot.folders) {
      if (f.scanState === 'error') {
        writer.setFolderScanState(f.id, 'error', { error: 'Scan failed' });
      } else if (writer.getFolder(f.id)?.scanState !== 'error') {
        writer.setFolderScanState(f.id, 'scanned');
      }
    }

    const foldersToMatch = folder ? [folder, ...snapshot.folders] : snapshot.folders;
    await applyLocalMatchesForFolders(pluginId, context, foldersToMatch);

    if (writer.getFolder(folderId)?.scanState !== 'error') {
      writer.setFolderScanState(folderId, 'scanned');
    }

    return snapshot;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Ошибка сканирования';
    writer.setFolderScanState(folderId, 'error', { error: reason });
    throw err;
  }
}
