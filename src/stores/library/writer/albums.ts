// src/stores/library/writer/albums.ts

import type { Album } from '@/types/album';
import type { AlbumId } from '@/types/ids';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

export function addAlbums(s: LibraryStore, albums: Album[]): void {
  for (const album of albums) {
    const existing = s.albums[album.id];
    if (existing) {
      // Не затираем существующую обложку пустой.
      // (Сценарий: при импорте пришел альбом без обложки, а он уже есть с обложкой).
      s.albums[album.id] = {
        ...existing,
        ...album,
        coverUrl: existing.coverUrl || album.coverUrl || null,
      };
    } else {
      s.albums[album.id] = album;
    }
  }
}

export function addOrUpdateAlbum(s: LibraryStore, album: Album): void {
  const existing = s.albums[album.id];
  if (existing) {
    s.albums[album.id] = {
      ...existing,
      ...album,
      // ВАЖНО: Обложку перезаписываем ТОЛЬКО если у существующей её нет.
      // Если пользователь уже видит какую-то обложку, мы не должны её менять
      // при повторном автопоиске.
      coverUrl: existing.coverUrl || album.coverUrl || null,
    };
  } else {
    s.albums[album.id] = album;
  }
}

export function removeAlbum(s: LibraryStore, id: AlbumId): void {
  delete s.albums[id];
}
