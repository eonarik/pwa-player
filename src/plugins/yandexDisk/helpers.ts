// src/plugins/yandexDisk/helpers.ts

import type { PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { folderStatusService } from '@/services/folders/FolderStatusService';
import type { ScanProgressCallback } from './scan';

/**
 * Прогресс-колбэк для scanAll → folderStatusService.
 * Соответствует `ScanProgressCallback` из `scan.ts`.
 */
export function makeProgress(): Pick<ScanProgressCallback, 'onStart' | 'onDone' | 'onError'> {
  return {
    onStart: (folderId: FolderId) => folderStatusService.markScanning(folderId),
    onDone: (folderId: FolderId) => folderStatusService.markScanned(folderId),
    onError: (folderId: FolderId, error: unknown) => {
      const reason = error instanceof Error ? error.message : 'Ошибка сканирования';
      folderStatusService.markError(folderId, reason);
    },
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
 *
 * Правила:
 * - Если хоть один ребёнок `scanning` или `pending` → родитель `scanning`.
 * - Иначе (все дети `scanned` или `error`) → родитель `scanned`.
 * - `error` НЕ пробрасывается родителю (error — локальный статус папки).
 */
export function updateParentsStatus(folderId: FolderId, foldersCache: PluginSnapshot['folders']): void {
  let parentId = foldersCache.find((f) => f.id === folderId)?.parentId;

  while (parentId) {
    const children = foldersCache.filter((f) => f.parentId === parentId);

    let hasScanning = false;
    let hasPending = false;

    for (const c of children) {
      const status = folderStatusService.getStatus(c.id);
      if (status === 'scanning') hasScanning = true;
      else if (status === 'pending') hasPending = true;
      // error игнорируется при суммаризации
    }

    if (hasScanning || hasPending) {
      folderStatusService.markScanning(parentId);
    } else {
      folderStatusService.markScanned(parentId);
    }

    // Идем выше
    parentId = foldersCache.find((f) => f.id === parentId)?.parentId;
  }
}
