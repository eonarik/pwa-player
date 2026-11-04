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

  /**
   * Индекс `artistKey → Track[]` для быстрого поиска кандидатов при merge.
   * artistKey = artist.trim().toLowerCase().
   *
   * Используется в history.recordPlay, dislikes.dislike — чтобы не строить
   * индекс на каждый play (O(N) → O(1) для одиночных операций).
   */
  const tracksByArtist = computed<Map<string, Track[]>>(() => {
    const index = new Map<string, Track[]>();
    for (const track of Object.values(tracks.value)) {
      const artistKey = (track.artist || '').trim().toLowerCase();
      const list = index.get(artistKey) || [];
      list.push(track);
      index.set(artistKey, list);
    }
    return index;
  });

  const childFoldersMap = computed<Map<FolderId, FolderRef[]>>(() => {
    const map = new Map<FolderId, FolderRef[]>();
    for (const folder of Object.values(folders.value)) {
      if (!folder.parentId) continue;
      const list = map.get(folder.parentId) || [];
      list.push(folder);
      map.set(folder.parentId, list);
    }
    return map;
  });

  const subtreeTracksMap = computed<Map<FolderId, Track[]>>(() => {
    const map = new Map<FolderId, Track[]>();
    const allFolders = Object.values(folders.value);

    const collectTracks = (folderId: FolderId, visited: Set<FolderId>): Track[] => {
      if (visited.has(folderId)) return [];
      visited.add(folderId);

      if (map.has(folderId)) return map.get(folderId)!;

      const result: Track[] = [];
      const folder = folders.value[folderId];
      if (!folder) return result;

      for (const trackId of folder.trackIds) {
        const track = tracks.value[trackId];
        if (track) result.push(track);
      }

      const children = childFoldersMap.value.get(folderId) || [];
      for (const child of children) {
        result.push(...collectTracks(child.id, visited));
      }

      map.set(folderId, result);
      return result;
    };

    for (const folder of allFolders) {
      collectTracks(folder.id, new Set());
    }

    return map;
  });

  const folderStats = computed(() => {
    const stats = new Map<FolderId, { folders: number; tracks: number }>();
    const allFolders = Object.values(folders.value);

    const count = (folderId: FolderId, visited: Set<FolderId>): { folders: number; tracks: number } => {
      if (visited.has(folderId)) return { folders: 0, tracks: 0 };
      visited.add(folderId);

      if (stats.has(folderId)) return stats.get(folderId)!;

      const folder = folders.value[folderId];
      if (!folder) return { folders: 0, tracks: 0 };

      let folderCount = 0;
      let trackCount = folder.trackIds.length;

      const children = childFoldersMap.value.get(folderId) || [];
      for (const child of children) {
        const childRes = count(child.id, visited);
        folderCount += 1 + childRes.folders;
        trackCount += childRes.tracks;
      }

      const res = { folders: folderCount, tracks: trackCount };
      stats.set(folderId, res);
      return res;
    };

    for (const folder of allFolders) {
      count(folder.id, new Set());
    }

    return stats;
  });

  const currentFolder = computed<FolderRef | null>(() => {
    if (!currentFolderId.value) return null;
    return folders.value[currentFolderId.value] ?? null;
  });

  const currentSubfolders = computed<FolderRef[]>(() => {
    const folder = currentFolder.value;
    if (!folder) return [];
    const list = childFoldersMap.value.get(folder.id) || [];
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

  void albums;

  return {
    tracksByAlbumId,
    tracksByArtist,
    childFoldersMap,
    subtreeTracksMap,
    folderStats,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    hasLibrary,
  };
}
