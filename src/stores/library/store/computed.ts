// src/stores/library/store/computed.ts

import { computed } from 'vue';
import type { Track } from '@/types/track';
import type { FolderRef } from '@/types/folder';
import type { AlbumId, FolderId, TrackId } from '@/types/ids';
import { sortService } from '@/services/sort/SortService';
import { normalizeMatchString } from '@/services/playlists/PlaylistMatcher';
import type { LibraryRefs } from './state';

export function createLibraryComputed(refs: LibraryRefs) {
  const { tracks, folders, currentFolderId } = refs;

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
   * artistKey = normalizeMatchString(artist) — так же, как в findBestMatch.
   *
   * Используется в history.recordPlay, dislikes.dislike — чтобы не строить
   * индекс на каждый play (O(N) → O(1) для одиночных операций).
   */
  const tracksByArtist = computed<Map<string, Track[]>>(() => {
    const index = new Map<string, Track[]>();
    for (const track of Object.values(tracks.value)) {
      const artistKey = normalizeMatchString(track.artist);
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

  /**
   * Плоский список папок поддерева в порядке «от листьев к корню».
   *
   * Обход итеративный: рекурсия по вложенности папок упиралась в потолок стека,
   * а `push(...childTracks)` — в RangeError на больших поддеревьях.
   * `completed` — папки, уже посчитанные предыдущими проходами: они не раскрываются
   * повторно, поэтому суммарная стоимость всех проходов линейна.
   * Циклы в `parentId` (повреждённые данные) не приводят к зависанию благодаря `seen`.
   */
  const postOrderFolders = (rootId: FolderId, completed: Set<FolderId>): FolderId[] => {
    const order: FolderId[] = [];
    const stack: FolderId[] = [rootId];
    const seen = new Set<FolderId>();

    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || seen.has(id) || completed.has(id)) continue;
      seen.add(id);
      order.push(id);

      const children = childFoldersMap.value.get(id);
      if (children) {
        for (const child of children) {
          stack.push(child.id);
        }
      }
    }

    return order.reverse();
  };

  const subtreeTracksMap = computed<Map<FolderId, Track[]>>(() => {
    const cache = new Map<FolderId, Track[]>();
    const completed = new Set<FolderId>();

    for (const root of Object.values(folders.value)) {
      for (const folderId of postOrderFolders(root.id, completed)) {
        const folder = folders.value[folderId];
        const result: Track[] = [];

        for (const trackId of folder?.trackIds ?? []) {
          const track = tracks.value[trackId];
          if (track) result.push(track);
        }

        // Дети уже в cache (пост-ордер), добавляем их треки без spread.
        const children = childFoldersMap.value.get(folderId);
        if (children) {
          for (const child of children) {
            const childTracks = cache.get(child.id);
            if (!childTracks) continue;
            for (const track of childTracks) result.push(track);
          }
        }

        cache.set(folderId, result);
        completed.add(folderId);
      }
    }

    return cache;
  });

  const folderStats = computed(() => {
    const stats = new Map<FolderId, { folders: number; tracks: number }>();
    const allFolders = Object.values(folders.value);

    // Тот же пост-ордер, что и для subtreeTracksMap: дети посчитаны до родителя,
    // каждая папка попадает в stats ровно один раз.
    const completed = new Set<FolderId>();

    for (const root of allFolders) {
      for (const folderId of postOrderFolders(root.id, completed)) {
        const folder = folders.value[folderId];
        let folderCount = 0;
        let trackCount = folder?.trackIds.length ?? 0;

        const children = childFoldersMap.value.get(folderId);
        if (children) {
          for (const child of children) {
            const childRes = stats.get(child.id);
            if (childRes) {
              folderCount += 1 + childRes.folders;
              trackCount += childRes.tracks;
            }
          }
        }

        stats.set(folderId, { folders: folderCount, tracks: trackCount });
        completed.add(folderId);
      }
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
