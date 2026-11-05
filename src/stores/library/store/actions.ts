// src/stores/library/store/actions.ts

import { get, set } from 'idb-keyval';
import type { Track } from '@/types/track';
import type { Album } from '@/types/album';
import type { FolderRef } from '@/types/folder';
import type { AlbumId, FolderId, TrackId } from '@/types/ids';
import { albumService } from '@/services/persistence/AlbumService';
import type { LibraryRefs } from './state';

const LIBRARY_KEY = 'player:library';

export function createLibraryActions(refs: LibraryRefs) {
  const { tracks, albums, folders, currentFolderId } = refs;

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

        const restoredFolders: Record<FolderId, FolderRef> = {};
        for (const [id, folder] of Object.entries(saved.folders || {})) {
          const scanState = folder.scanState ?? 'pending';

          restoredFolders[id as FolderId] = {
            ...folder,
            trackIds: folder.trackIds || [],
            files: folder.files || [],
            scanState: scanState === 'scanning' ? 'pending' : scanState,
            scanProgress: undefined,
            scanError: folder.scanError,
            scanStateUpdatedAt: folder.scanStateUpdatedAt ?? 0,
          };
        }
        folders.value = restoredFolders;
      }
    } catch (err) {
      console.error('[library] failed to restore library from IDB', err);
    }
  }

  return {
    setCurrentFolder,
    getTrack,
    getAlbum,
    getFolder,
    clear,
    restore,
  };
}
