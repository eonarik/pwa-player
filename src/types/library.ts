// src/types/library.ts

import type { Track } from './track';
import type { Album } from './album';
import type { FolderRef } from './folder';
import type { TrackId, AlbumId, FolderId } from './ids';

export interface LibraryState {
  tracks: Record<TrackId, Track>;
  albums: Record<AlbumId, Album>;
  folders: Record<FolderId, FolderRef>;
}

// Реэкспорт для обратной совместимости импортов
export type {
  Track,
  TrackSource,
  TrackSourceKind,
  LocalTrackSource,
  CloudTrackSource,
  StreamingTrackSource,
} from './track';
export type { Album } from './album';
export type { FolderRef } from './folder';
export type { RawMetadata, MetadataCandidate } from './metadata';
export type { Playlist, HistoryCollection, DislikesCollection, CollectionsState } from './collection';
export type { PluginTrackPayload, PluginFolderPayload, PluginSnapshot } from './plugin';
export type { TrackId, AlbumId, FolderId, TrackSourceId, MetadataCandidateId, PlaylistId } from './ids';
