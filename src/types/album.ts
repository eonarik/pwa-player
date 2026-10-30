// src/types/album.ts

import type { AlbumId } from './ids';

/**
 * Альбом. Без trackIds — связь через Track.albumId.
 * Обложка живёт ТОЛЬКО здесь (для треков с альбомом).
 */
export interface Album {
  id: AlbumId;
  name: string;
  artist: string;
  coverUrl: string | null;
}
