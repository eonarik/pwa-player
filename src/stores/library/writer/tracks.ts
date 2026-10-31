// src/stores/library/writer/tracks.ts

import type { Track, TrackSource } from '@/types/track';
import type { AlbumId, TrackId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import { librarySaveService } from '@/services/library/LibrarySaveService';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

function syncFolderTrackIds(s: LibraryStore, track: Track, action: 'add' | 'remove'): void {
  for (const source of track.sources) {
    if (source.kind === 'local' || source.kind === 'cloud') {
      const folder = s.folders[source.folderId];

      if (!folder) continue;

      if (action === 'add') {
        if (!folder.trackIds.includes(track.id)) {
          folder.trackIds.push(track.id);
        }
      } else {
        const idx = folder.trackIds.indexOf(track.id);
        if (idx !== -1) {
          folder.trackIds.splice(idx, 1);
        }
      }
    }
  }
}

export function addTracks(s: LibraryStore, tracks: Track[], sourceId: string): void {
  for (const track of tracks) {
    s.tracks[track.id] = track;
    syncFolderTrackIds(s, track, 'add');
  }
  if (sourceId) {
    librarySaveService.scheduleSave(sourceId);
  }
}

export function removeTrack(s: LibraryStore, id: TrackId): void {
  const track = s.tracks[id];
  if (!track) return;

  syncFolderTrackIds(s, track, 'remove');
  delete s.tracks[id];

  const pluginIds = new Set(track.sources.map((s) => s.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

export function updateTrackSources(s: LibraryStore, id: TrackId, sources: TrackSource[]): void {
  const track = s.tracks[id];
  if (!track) return;

  // Удаляем trackId из старых папок
  syncFolderTrackIds(s, track, 'remove');

  // Обновляем sources
  s.tracks[id] = { ...track, sources };

  // Добавляем trackId в новые папки
  syncFolderTrackIds(s, s.tracks[id]!, 'add');

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

export function updateTrackMetadata(
  s: LibraryStore,
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
): void {
  const track = s.tracks[id];
  if (!track) return;
  s.tracks[id] = { ...track, ...patch };
  const pluginIds = new Set(track.sources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}
