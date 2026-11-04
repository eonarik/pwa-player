// src/services/metadata/types.ts

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  trackNumber?: number;
  genre?: string;
  /** http(s)-обложка. Для альбома (Album.coverUrl) или для трека без альбома (Track.coverUrl). */
  coverUrl?: string;
  /** Длительность из тегов, если указана */
  duration?: number;
  /** Формат: mp3, flac и т.д. */
  codec?: string;
  /** true, если в файле реально есть теги (artist или album непустые) */
  hasId3Tags: boolean;
}

/**
 * Результат парсинга ID3 в worker.
 *
 * `metadata` — обычный TrackMetadata (без обложки).
 * `coverBlob` — Blob обложки из ID3 (picture). Отдельно от metadata:
 *   - обложка идёт в Album.coverBlob (только если у трека есть альбом);
 *   - TrackMetadata.coverBlob не существует — обложка не часть универсального контракта.
 */
export interface ParsedId3 {
  metadata: TrackMetadata;
  coverBlob: Blob | null;
}
