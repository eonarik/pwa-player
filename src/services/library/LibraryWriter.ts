// src/services/library/LibraryWriter.ts

import type { Track, TrackSource } from '@/types/track';
import type { Album } from '@/types/album';
import type { FolderRef, FolderScanState, FolderScanProgress } from '@/types/folder';
import type { MetadataCandidate } from '@/types/metadata';
import type { AlbumId, TrackId, FolderId } from '@/types/ids';
import type { PluginSnapshot, PluginFolderPayload } from '@/types/plugin';

export interface CleanupScope {
  /** Где удалять отсутствующие треки (по source.folderId). */
  trackScope: Set<FolderId>;
  /** Где удалять отсутствующие папки (по folder.id). */
  folderScope: Set<FolderId>;
}

export interface LibraryWriter {
  // --- Чтение ---
  getTrack(id: TrackId): Track | null;
  getAlbum(id: AlbumId): Album | null;
  getFolder(id: FolderId): FolderRef | null;
  getFoldersBySource(sourceId: string): FolderRef[];
  getAllTracks(): Track[];
  getAllAlbums(): Album[];

  // --- Запись (сериализовано через mutex) ---
  setLibrary(snapshot: PluginSnapshot, sourceId: string, opts?: { cleanup?: CleanupScope }): Promise<void>;
  addFolders(folders: PluginFolderPayload[], sourceId: string): Promise<void>;
  removeFolderRef(id: FolderId): Promise<void>;

  addAlbums(albums: Album[]): Promise<void>;
  addOrUpdateAlbum(album: Album): Promise<void>;
  removeAlbum(id: AlbumId): Promise<void>;

  addTracks(tracks: Track[], sourceId: string): Promise<void>;
  removeTrack(id: TrackId): Promise<void>;
  updateTrackSources(id: TrackId, sources: TrackSource[]): Promise<void>;
  updateTrackAlbumId(id: TrackId, albumId: AlbumId | null): Promise<void>;
  updateTrackMetadataCandidates(id: TrackId, candidates: MetadataCandidate[]): Promise<void>;

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
  ): Promise<void>;

  removeBySource(sourceId: string): Promise<void>;
  reconcileFolderTrackIds(): Promise<void>;

  removeCloudSourcesInFolders(subtreeIds: Set<FolderId>): Promise<void>;
  cleanupOrphanAlbums(): Promise<void>;

  setFolderScanState(
    id: FolderId,
    state: FolderScanState,
    opts?: { error?: string; progress?: FolderScanProgress },
  ): Promise<void>;
  updateFolderScanProgress(id: FolderId, progress: FolderScanProgress): Promise<void>;
}
