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

  /**
   * Синхронизация `folder.trackIds` ↔ `source.folderId`.
   */
  reconcileFolderTrackIds(): void;

  // --- Force scan ---

  /**
   * Удаляет `cloud`-source у треков, чей `folderId` входит в `subtreeIds`.
   * Если после этого у трека не остаётся sources — трек удаляется (если он
   * не используется в плейлистах/истории/очереди; это решает `libraryStore.cleanupOrphanTracks`
   * на следующем bootstrap, здесь — только пометка).
   *
   * Используется перед force scan (опционально) или в `cleanupForceScan`.
   */
  removeCloudSourcesInFolders(subtreeIds: Set<FolderId>): void;

  /**
   * Гибридная чистка после force scan: сравнивает `library` с `snapshot`
   * (в поддереве `subtreeIds`) и удаляет «лишнее» — треки без sources и папки,
   * которых нет в `snapshot`. Вызывается ПОСЛЕ `setLibrary`.
   */
  cleanupForceScan(subtreeIds: Set<FolderId>, snapshot: PluginSnapshot): void;

  /** Удаляет пустые альбомы (без треков). */
  cleanupOrphanAlbums(): void;
}
