// src/types/index.ts

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
export { FAVORITES_PLAYLIST_ID } from './collection';
export type { LibraryState } from './library';
export type { PluginTrackPayload, PluginFolderPayload, PluginSnapshot } from './plugin';
export type { Playability } from './playability';
export type { TransferState } from './transfer';
export type { FilterOption } from './filter';
export type { TrackId, AlbumId, FolderId, TrackSourceId, MetadataCandidateId, PlaylistId } from './ids';
