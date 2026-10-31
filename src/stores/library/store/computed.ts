// src/stores/library/store/computed.ts

import { computed } from 'vue';
import type { Track } from '@/types/track';
import type { FolderRef } from '@/types/folder';
import type { AlbumId, FolderId, TrackId } from '@/types/ids';
import { sortService } from '@/services/sort/SortService';
import type { LibraryRefs } from './state';

export function createLibraryComputed(refs: LibraryRefs) {
  const { tracks, albums, folders, currentFolderId } = refs;

  const tracksByAlbumId = computed<Record<AlbumId, TrackId[]>>(() => {
    const index: Record<AlbumId, TrackId[]> = {} as Record<AlbumId, TrackId[]>;
    for (const track of Object.values(tracks.value)) {
      if (!track.albumId) continue;
      const list = index[track.albumId] ?? [];
      list.push(track.id);
      index[track.albumId] = list;
    }
    return index;
  });

  const currentFolder = computed<FolderRef | null>(() => {
    if (!currentFolderId.value) return null;
    return folders.value[currentFolderId.value] ?? null;
  });

  const currentSubfolders = computed<FolderRef[]>(() => {
    const folder = currentFolder.value;
    if (!folder) return [];
    const list = Object.values(folders.value).filter((f) => f.parentId === folder.id);
    return sortService.sortByName(list);
  });

  const currentTracks = computed<Track[]>(() => {
    const folder = currentFolder.value;
    if (!folder) return [];

    const seen = new Set<TrackId>();
    const list: Track[] = [];

    for (const id of folder.trackIds || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const track = tracks.value[id];
      if (track) list.push(track);
    }

    return sortService.sort(list);
  });

  const breadcrumbs = computed<FolderRef[]>(() => {
    const crumbs: FolderRef[] = [];
    let folder = currentFolder.value;
    const visited = new Set<FolderId>();
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id);
      crumbs.unshift(folder);
      folder = folder.parentId ? (folders.value[folder.parentId] ?? null) : null;
    }
    return crumbs;
  });

  const hasLibrary = computed(() => Object.keys(tracks.value).length > 0 || Object.keys(folders.value).length > 0);

  // `albums` в computed не участвует напрямую, но пробросим для симметрии
  void albums;

  return {
    tracksByAlbumId,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    hasLibrary,
  };
}
