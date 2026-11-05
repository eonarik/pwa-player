// src/stores/library/writer/folders.ts

import type { FolderId } from '@/types/ids';
import type { PluginFolderPayload } from '@/types/plugin';
import type { FolderScanState } from '@/types/folder';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

export function setFolders(s: LibraryStore, folders: PluginFolderPayload[], sourceId: string): void {
  for (const folder of folders) {
    const existing = s.folders[folder.id];

    s.folders[folder.id] = {
      id: folder.id,
      pluginId: sourceId,
      name: folder.name,
      parentId: folder.parentId,
      urlPath: folder.urlPath,
      trackIds: existing?.trackIds ?? folder.trackIds ?? [],
      files: folder.files ?? existing?.files ?? [],
      scanState: existing?.scanState ?? folder.scanState ?? 'pending',
      scanProgress: existing?.scanProgress,
      scanError: existing?.scanError,
      scanStateUpdatedAt: existing?.scanStateUpdatedAt ?? Date.now(),
    };
  }
}

export function removeFolderRef(s: LibraryStore, id: FolderId): void {
  const folder = s.folders[id];
  if (!folder) return;

  for (const f of Object.values(s.folders)) {
    if (f.parentId === id) {
      s.folders[f.id] = { ...f, parentId: null };
    }
  }

  delete s.folders[id];
}

export function removeFoldersBySource(s: LibraryStore, sourceId: string): void {
  const toRemove: FolderId[] = [];
  for (const [id, folder] of Object.entries(s.folders)) {
    if (folder.pluginId === sourceId) {
      toRemove.push(id as FolderId);
    }
  }
  for (const id of toRemove) {
    delete s.folders[id];
  }

  if (s.currentFolderId && !s.folders[s.currentFolderId]) {
    s.currentFolderId = null;
  }
}

/**
 * Устанавливает статус сканирования папки.
 * Это единственный способ изменить статус (все остальные — обёртки над ним).
 */
export function setFolderScanState(
  s: LibraryStore,
  id: FolderId,
  state: FolderScanState,
  opts?: { error?: string; progress?: { done: number; total: number } },
): void {
  const folder = s.folders[id];
  if (!folder) {
    console.warn('[setFolderScanState] FOLDER NOT FOUND', id, 'existing folders:', Object.keys(s.folders));
    return;
  }
  // Если статус не меняется и это просто обновление прогресса — не трогаем updatedAt
  const isStateChange = folder.scanState !== state;

  s.folders[id] = {
    ...folder,
    scanState: state,
    scanProgress: state === 'scanning' ? (opts?.progress ?? folder.scanProgress) : undefined,
    scanError: state === 'error' ? opts?.error : undefined,
    scanStateUpdatedAt: isStateChange ? Date.now() : folder.scanStateUpdatedAt,
  };
}

/**
 * Обновляет только прогресс, если папка в статусе 'scanning'.
 */
export function updateFolderScanProgress(
  s: LibraryStore,
  id: FolderId,
  progress: { done: number; total: number },
): void {
  const folder = s.folders[id];
  if (!folder) return;
  if (folder.scanState !== 'scanning') return;

  s.folders[id] = { ...folder, scanProgress: progress };
}
