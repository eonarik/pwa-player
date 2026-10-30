// src/services/metadata/types.ts

export interface TrackMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  trackNumber?: number;
  genre?: string;
  /** URL для objectURL (blob) — создаётся из обложки, если она есть */
  coverUrl?: string;
  /** Длительность из тегов, если указана */
  duration?: number;
  /** Формат: mp3, flac и т.д. */
  codec?: string;
  /** true, если в файле реально есть теги (artist или album непустые) */
  hasId3Tags: boolean;
}
