// src/stores/library/writer/folders.ts

import type { FolderId } from '@/types/ids';
import type { PluginFolderPayload } from '@/types/plugin';
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
      // Если папка уже была, сохраняем её trackIds. Иначе создаем пустой массив.
      trackIds: existing?.trackIds ?? folder.trackIds ?? [],
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
