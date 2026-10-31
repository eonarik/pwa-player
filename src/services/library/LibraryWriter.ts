// src/services/library/LibraryWriter.ts

import type { Track, TrackSource } from '@/types/track';
import type { Album } from '@/types/album';
import type { FolderRef } from '@/types/folder';
import type { MetadataCandidate } from '@/types/metadata';
import type { AlbumId, TrackId, FolderId } from '@/types/ids';
import type { PluginSnapshot, PluginFolderPayload } from '@/types/plugin';

export interface LibraryWriter {
  // --- Чтение ---
  getTrack(id: TrackId): Track | null;
  getAlbum(id: AlbumId): Album | null;
  getFolder(id: FolderId): FolderRef | null;
  getFoldersBySource(sourceId: string): FolderRef[];
  getAllTracks(): Track[];
  getAllAlbums(): Album[];

  // --- Запись ---
  setLibrary(snapshot: PluginSnapshot, sourceId: string): Promise<void>;
  addFolders(folders: PluginFolderPayload[], sourceId: string): void;
  removeFolderRef(id: FolderId): void;

  addAlbums(albums: Album[]): void;
  addOrUpdateAlbum(album: Album): void;
  removeAlbum(id: AlbumId): void;

  addTracks(tracks: Track[], sourceId: string): void;
  removeTrack(id: TrackId): void;
  updateTrackSources(id: TrackId, sources: TrackSource[]): void;
  updateTrackAlbumId(id: TrackId, albumId: AlbumId | null): void;
  updateTrackMetadataCandidates(id: TrackId, candidates: MetadataCandidate[]): void;

  // --- Метаданные ---
  updateTrackMetadata(
    id: TrackId,
    patch: Partial<
      Pick<
        Track,
        | 'artist'
        | 'title'
        | 'albumId'
        | 'coverUrl'
        | 'hasId3Tags'
        | 'duration'
        | 'codec'
        | 'raw'
        | 'metadataCandidates'
        | 'hasMetadataEdits'
        | 'metaSource'
      >
    >,
  ): void;

  // --- Служебные ---
  removeBySource(sourceId: string): void;
}
