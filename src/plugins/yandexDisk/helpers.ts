// src/plugins/yandexDisk/helpers.ts

import type { PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { folderStatusService } from '@/services/folders/FolderStatusService';

/** Прогресс-колбэк для scanAll → folderStatusService. */
export function makeProgress() {
  return {
    onStart: (folderId: FolderId) => folderStatusService.markScanning(folderId),
    onDone: (folderId: FolderId) => folderStatusService.markScanned(folderId),
    onError: (folderId: FolderId) => folderStatusService.markError(folderId, 'Scan failed'),
  };
}

/** После скана: зарегистрировать папки в сервисе статусов. */
export function registerFolders(folders: PluginSnapshot['folders'], scanned: Set<FolderId>): void {
  for (const f of folders) {
    if (folderStatusService.getStatus(f.id) !== null) continue;
    folderStatusService.register(f.id, scanned.has(f.id) ? 'scanned' : 'pending');
  }
}

/**
 * Помечает папку и всех её родителей как scanning.
 * Использует foldersCache для поиска родителя.
 */
export function markScanningParents(folderId: FolderId, foldersCache: PluginSnapshot['folders']): void {
  folderStatusService.markScanning(folderId);

  let parentId = foldersCache.find((f) => f.id === folderId)?.parentId;
  while (parentId) {
    folderStatusService.markScanning(parentId);
    parentId = foldersCache.find((f) => f.id === parentId)?.parentId;
  }
}

/**
 * После завершения скана проверяет статусы родителей.
 * Если у родителя остались pending/scanning дети, он не может быть scanned.
 */
export function updateParentsStatus(folderId: FolderId, foldersCache: PluginSnapshot['folders']): void {
  let parentId = foldersCache.find((f) => f.id === folderId)?.parentId;

  while (parentId) {
    const children = foldersCache.filter((f) => f.parentId === parentId);

    let hasScanning = false;
    let hasPending = false;
    let hasError = false;

    for (const c of children) {
      const status = folderStatusService.getStatus(c.id);
      if (status === 'scanning') hasScanning = true;
      else if (status === 'pending') hasPending = true;
      else if (status === 'error') hasError = true;
    }

    if (hasError) {
      folderStatusService.markError(parentId, 'Ошибка в дочерней папке');
    } else if (hasScanning) {
      folderStatusService.markScanning(parentId);
    } else if (hasPending) {
      folderStatusService.markPending(parentId);
    } else {
      folderStatusService.markScanned(parentId);
    }

    // Идем выше
    parentId = foldersCache.find((f) => f.id === parentId)?.parentId;
  }
}
