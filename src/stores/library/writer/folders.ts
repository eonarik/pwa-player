// src/stores/library/writer/folders.ts

import type { FolderId, TrackId } from '@/types/ids';
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
  const isStateChange = folder.scanState !== state;

  s.folders[id] = {
    ...folder,
    scanState: state,
    scanProgress: state === 'scanning' ? (opts?.progress ?? folder.scanProgress) : undefined,
    scanError: state === 'error' ? opts?.error : undefined,
    scanStateUpdatedAt: isStateChange ? Date.now() : folder.scanStateUpdatedAt,
  };
}

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

/**
 * После переименования папки на Диске: обновляет name+urlPath поддерева
 * (включая files[].urlPath) и remotePath соответствующих cloud-sources.
 * trackId/folderId не меняются, плейлисты/история/дизлайки остаются валидными.
 *
 * `oldUrlPath` / `newUrlPath` — без ведущего слэша (как в library).
 * Если `oldUrlPath === ''` (корень плагина) — no-op (корень не переименовывается).
 */
export function renameFolderSubtree(
  s: LibraryStore,
  oldUrlPath: string,
  newUrlPath: string,
): { updatedFolderIds: Set<FolderId>; updatedTrackIds: Set<TrackId> } {
  const updatedFolderIds = new Set<FolderId>();
  const updatedTrackIds = new Set<TrackId>();

  if (!oldUrlPath || oldUrlPath === newUrlPath) {
    return { updatedFolderIds, updatedTrackIds };
  }

  const oldPrefix = oldUrlPath + '/';
  const newPrefix = newUrlPath + '/';
  const newName = newUrlPath.split('/').pop() ?? newUrlPath;

  // 1. Обновляем name + urlPath у папки и всех потомков + files[].urlPath.
  for (const folder of Object.values(s.folders)) {
    let nextUrlPath: string | null = null;
    let nextName = folder.name;

    if (folder.urlPath === oldUrlPath) {
      nextUrlPath = newUrlPath;
      // Обновляем имя переименованной папки (последний сегмент).
      nextName = newName;
    } else if (folder.urlPath.startsWith(oldPrefix)) {
      nextUrlPath = newPrefix + folder.urlPath.slice(oldPrefix.length);
      // У потомков имя не меняется (последний сегмент urlPath тот же).
    }

    if (nextUrlPath === null) continue;

    const nextFiles = folder.files?.map((f) => {
      if (f.urlPath === oldUrlPath) return { ...f, urlPath: newUrlPath };
      if (f.urlPath.startsWith(oldPrefix)) {
        return { ...f, urlPath: newPrefix + f.urlPath.slice(oldPrefix.length) };
      }
      return f;
    });

    s.folders[folder.id] = {
      ...folder,
      name: nextName,
      urlPath: nextUrlPath,
      files: nextFiles ?? folder.files,
    };
    updatedFolderIds.add(folder.id);
  }

  if (updatedFolderIds.size === 0) {
    return { updatedFolderIds, updatedTrackIds };
  }

  // 2. Обновляем remotePath у cloud-sources в поддереве.
  for (const track of Object.values(s.tracks)) {
    let changed = false;

    const nextSources = track.sources.map((src) => {
      if (src.kind !== 'cloud') return src;
      if (!updatedFolderIds.has(src.folderId)) return src;

      const oldRemote = src.remotePath;
      const hadDiskPrefix = oldRemote.startsWith('disk:/');
      const normalized = oldRemote.replace(/^disk:\//, '').replace(/^\/+/, '');

      let nextRemote: string;
      if (normalized === oldUrlPath) {
        nextRemote = newUrlPath;
      } else if (normalized.startsWith(oldPrefix)) {
        nextRemote = newPrefix + normalized.slice(oldPrefix.length);
      } else {
        return src;
      }

      if (hadDiskPrefix) {
        nextRemote = `disk:/${nextRemote}`;
      }

      changed = true;
      return { ...src, remotePath: nextRemote };
    });

    if (changed) {
      s.tracks[track.id] = { ...track, sources: nextSources };
      updatedTrackIds.add(track.id);
    }
  }

  return { updatedFolderIds, updatedTrackIds };
}
