// src/stores/library/writer/albums.ts

import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

export function addAlbums(s: LibraryStore, albums: Album[]): void {
  for (const album of albums) {
    s.albums[album.id] = album;
  }
}

export function addOrUpdateAlbum(s: LibraryStore, album: Album): void {
  const existing = s.albums[album.id];
  if (existing) {
    s.albums[album.id] = {
      ...existing,
      ...album,
      // Обложку не перезаписываем, если у существующего она есть
      coverUrl: existing.coverUrl ?? album.coverUrl,
    };
  } else {
    s.albums[album.id] = album;
  }
}

export function removeAlbum(s: LibraryStore, id: AlbumId): void {
  delete s.albums[id];
}
