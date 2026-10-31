// src/stores/library/store.ts

import { defineStore } from 'pinia';
import { computed, ref, watch, toRaw } from 'vue';
import { get, set } from 'idb-keyval';
import type { Track } from '@/types/track';
import type { Album } from '@/types/album';
import type { FolderRef } from '@/types/folder';
import type { AlbumId, FolderId, TrackId } from '@/types/ids';
import { sortService } from '@/services/sort/SortService';
import { albumService } from '@/services/persistence/AlbumService';

const LIBRARY_KEY = 'player:library';

// Утилита для глубокого снятия Proxy (нужна для structuredClone)
function deepToRaw<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepToRaw) as unknown as T;
  if (typeof window !== 'undefined' && (obj instanceof FileSystemFileHandle || obj instanceof Blob)) {
    return obj;
  }

  const raw = toRaw(obj);
  const result: Record<string, unknown> = {};
  for (const key in raw) {
    result[key] = deepToRaw(raw[key]);
  }
  return result as T;
}

export const useLibraryStore = defineStore('library', () => {
  const tracks = ref<Record<TrackId, Track>>({});
  const albums = ref<Record<AlbumId, Album>>({});
  const folders = ref<Record<FolderId, FolderRef>>({});
  const currentFolderId = ref<FolderId | null>(null);

  // --- Сохранение в IndexedDB (с дебаунсом) ---
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    [tracks, folders],
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          const rawData = {
            tracks: deepToRaw(tracks.value),
            folders: deepToRaw(folders.value),
          };
          await set(LIBRARY_KEY, rawData);
        } catch (err) {
          console.warn('[library] failed to persist library', err);
        }
      }, 1000);
    },
    { deep: true },
  );

  watch(albums, () => void albumService.saveAll(albums.value), { deep: true });

  // --- Computed ---
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

    // Берем треки прямо из folder.trackIds (новый подход)
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

  // --- Actions ---
  function setCurrentFolder(id: FolderId): void {
    if (!folders.value[id]) return;
    currentFolderId.value = id;
  }

  function getTrack(id: TrackId): Track | null {
    return tracks.value[id] ?? null;
  }

  function getAlbum(id: AlbumId): Album | null {
    return albums.value[id] ?? null;
  }

  function getFolder(id: FolderId): FolderRef | null {
    return folders.value[id] ?? null;
  }

  function clear(): void {
    tracks.value = {};
    albums.value = {};
    folders.value = {};
    currentFolderId.value = null;
    void albumService.clear();
    void set(LIBRARY_KEY, { tracks: {}, folders: {} });
  }

  async function restore(): Promise<void> {
    const savedAlbums = await albumService.loadAll();
    albums.value = savedAlbums;

    try {
      const saved = await get<{ tracks: Record<TrackId, Track>; folders: Record<FolderId, FolderRef> }>(LIBRARY_KEY);
      if (saved) {
        tracks.value = saved.tracks || {};

        // При восстановлении проверяем, что у папок есть trackIds (для обратной совместимости)
        const restoredFolders: Record<FolderId, FolderRef> = {};
        for (const [id, folder] of Object.entries(saved.folders || {})) {
          restoredFolders[id as FolderId] = {
            ...folder,
            trackIds: folder.trackIds || [],
          };
        }
        folders.value = restoredFolders;
      }
    } catch (err) {
      console.error('[library] failed to restore library from IDB', err);
    }
  }

  function cleanupOrphanAlbums(): void {
    const orphanIds: AlbumId[] = [];
    for (const [id, album] of Object.entries(albums.value)) {
      if (!tracksByAlbumId.value[album.id]) {
        orphanIds.push(id as AlbumId);
      }
    }
    for (const id of orphanIds) {
      delete albums.value[id];
    }
  }

  return {
    tracks,
    albums,
    folders,
    currentFolderId,
    tracksByAlbumId,
    currentFolder,
    currentSubfolders,
    currentTracks,
    breadcrumbs,
    hasLibrary,
    setCurrentFolder,
    getTrack,
    getAlbum,
    getFolder,
    clear,
    restore,
    cleanupOrphanAlbums,
  };
});
