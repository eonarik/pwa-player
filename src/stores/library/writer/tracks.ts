// src/stores/library/writer/tracks.ts

import type { Track, TrackSource } from '@/types/track';
import type { AlbumId, TrackId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import { librarySaveService } from '@/services/library/LibrarySaveService';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

export function addTracks(s: LibraryStore, tracks: Track[], sourceId: string): void {
  for (const track of tracks) {
    s.tracks[track.id] = track;
  }
  if (sourceId) {
    librarySaveService.scheduleSave(sourceId);
  }
}

export function removeTrack(s: LibraryStore, id: TrackId): void {
  const track = s.tracks[id];
  if (!track) return;

  // Убираем трек из альбома (albumId остаётся у трека, но трек удаляется)
  delete s.tracks[id];

  // Планируем сохранение кэша плагинов, которые были у трека
  const pluginIds = new Set(track.sources.map((s) => s.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

export function updateTrackSources(s: LibraryStore, id: TrackId, sources: TrackSource[]): void {
  const track = s.tracks[id];
  if (!track) return;
  s.tracks[id] = { ...track, sources };
  const pluginIds = new Set(sources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

export function updateTrackAlbumId(s: LibraryStore, id: TrackId, albumId: AlbumId | null): void {
  const track = s.tracks[id];
  if (!track) return;
  s.tracks[id] = { ...track, albumId };
  const pluginIds = new Set(track.sources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

export function updateTrackMetadataCandidates(s: LibraryStore, id: TrackId, candidates: MetadataCandidate[]): void {
  const track = s.tracks[id];
  if (!track) return;
  s.tracks[id] = { ...track, metadataCandidates: candidates };
  const pluginIds = new Set(track.sources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

/**
 * Обновление метаданных (artist/title/album/coverUrl/duration/codec/hasId3Tags/raw).
 * Используется MetadataService.
 */
export function updateTrackMetadata(
  s: LibraryStore,
  id: TrackId,
  patch: Partial<
    Pick<
      Track,
      'artist' | 'title' | 'albumId' | 'coverUrl' | 'hasId3Tags' | 'duration' | 'codec' | 'raw' | 'metadataCandidates'
    >
  >,
): void {
  const track = s.tracks[id];
  if (!track) return;
  s.tracks[id] = { ...track, ...patch };
  const pluginIds = new Set(track.sources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}
