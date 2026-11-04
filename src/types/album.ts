// src/types/album.ts

import type { AlbumId } from './ids';

export interface Album {
  id: AlbumId;
  name: string;
  artist: string;
  /** http(s)-обложка из метаданных (iTunes/Deezer/Zvuk). Вторична. */
  coverUrl: string | null;
  /** Blob-обложка из ID3 файла. Первична. Не сериализуется в JSON — только structuredClone. */
  coverBlob?: Blob;
}
