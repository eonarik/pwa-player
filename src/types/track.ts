// src/types/track.ts

import type { AlbumId, FolderId, TrackId, TrackSourceId } from './ids';
import type { RawMetadata, MetadataCandidate } from './metadata';

export type TrackSourceKind = 'local' | 'cloud' | 'streaming';

interface TrackSourceBase {
  id: TrackSourceId;
  pluginId: string;
  priority: number;
}

export interface LocalTrackSource extends TrackSourceBase {
  kind: 'local';
  handle: FileSystemFileHandle;
  folderId: FolderId;
  relativePath?: string;
}

export interface CloudTrackSource extends TrackSourceBase {
  kind: 'cloud';
  remotePath: string;
  folderId: FolderId;
}

export interface StreamingTrackSource extends TrackSourceBase {
  kind: 'streaming';
  url: string;
}

export type TrackSource = LocalTrackSource | CloudTrackSource | StreamingTrackSource;

export interface Track {
  id: TrackId;

  /** Плагин «первого» (приоритетного) источника — для UI-удобства. */
  pluginId: string;

  // --- Домен ---
  artist: string;
  title: string;
  albumId: AlbumId | null;
  coverUrl: string | null;

  // --- Источники ---
  sources: TrackSource[];
  metadataCandidates: MetadataCandidate[];

  // --- Первичные метаданные (для сброса) ---
  raw: RawMetadata | null;

  // --- Флаги ---
  hasId3Tags: boolean;

  // --- Метаданные для UI ---
  duration?: number;
  codec?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
}
