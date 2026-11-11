// src/stores/library/writer/tracks.ts
import type { Track, TrackSource } from '@/types/track';
import type { AlbumId, FolderId, TrackId, TrackSourceId } from '@/types/ids';
import type { MetadataCandidate } from '@/types/metadata';
import { librarySaveService } from '@/services/library/LibrarySaveService';
import { isFolderSource } from '@/services/library/selectors';
import { pluginIdFromSource } from '@/plugins/registry';
import type { useLibraryStore } from '../store';

type LibraryStore = ReturnType<typeof useLibraryStore>;

function syncFolderTrackIds(s: LibraryStore, track: Track, action: 'add' | 'remove'): void {
  for (const source of track.sources) {
    if (!isFolderSource(source)) continue;
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

/**
 * Сортирует sources по priority (стабильно) и вычисляет pluginId
 * из первого (самого приоритетного) источника.
 *
 * Инвариант: `pluginId === pluginIdFromSource(sources[0]?.pluginId ?? '')`.
 * При пустом sources — `pluginId === ''`.
 */
function normalizeSources(sources: TrackSource[]): { sources: TrackSource[]; pluginId: string } {
  const sorted = [...sources].sort((a, b) => a.priority - b.priority);
  const first = sorted[0];
  const pluginId = first ? pluginIdFromSource(first.pluginId) : '';
  return { sources: sorted, pluginId };
}

/**
 * Пакетная привязка треков к папкам.
 *
 * Сканирование папки приносит тысячи треков за один вызов, а пооперационный
 * `trackIds.includes(...)` (как в syncFolderTrackIds) дал бы O(N²) на большой папке.
 * Здесь множество участников каждой папки строится один раз.
 */
function linkTracksToFolders(s: LibraryStore, tracks: Track[]): void {
  const members = new Map<FolderId, Set<TrackId>>();
  const nextTrackIds = new Map<FolderId, TrackId[]>();

  for (const track of tracks) {
    for (const source of track.sources) {
      if (!isFolderSource(source)) continue;

      const folder = s.folders[source.folderId];
      if (!folder) continue;

      let seen = members.get(source.folderId);
      if (!seen) {
        seen = new Set(folder.trackIds);
        members.set(source.folderId, seen);
        nextTrackIds.set(source.folderId, [...folder.trackIds]);
      }

      if (seen.has(track.id)) continue;
      seen.add(track.id);
      nextTrackIds.get(source.folderId)?.push(track.id);
    }
  }

  for (const [folderId, trackIds] of nextTrackIds) {
    const folder = s.folders[folderId];
    if (folder) folder.trackIds = trackIds;
  }
}

export function addTracks(s: LibraryStore, tracks: Track[], sourceId: string): void {
  const stored: Track[] = [];

  for (const track of tracks) {
    const { sources, pluginId } = normalizeSources(track.sources);
    const normalized: Track = { ...track, sources, pluginId };

    s.tracks[normalized.id] = normalized;
    stored.push(normalized);
  }

  linkTracksToFolders(s, stored);

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

  const { sources: normalizedSources, pluginId } = normalizeSources(sources);

  syncFolderTrackIds(s, track, 'remove');
  s.tracks[id] = { ...track, sources: normalizedSources, pluginId };
  syncFolderTrackIds(s, s.tracks[id]!, 'add');

  const pluginIds = new Set(normalizedSources.map((src) => src.pluginId));
  for (const pid of pluginIds) {
    librarySaveService.scheduleSave(pid);
  }
}

/**
 * Удаляет конкретный source у трека (по source.id).
 *
 * Используется при удалении файла на Диске (без force-скана).
 * Если sources станет пустым — трек остаётся в library (сирота),
 * его почистит cleanupOrphanTracks на старте (если он нигде не используется).
 */
export function removeTrackSource(s: LibraryStore, id: TrackId, sourceId: TrackSourceId): void {
  const track = s.tracks[id];
  if (!track) return;

  const nextSources = track.sources.filter((src) => src.id !== sourceId);
  if (nextSources.length === track.sources.length) return;

  updateTrackSources(s, id, nextSources);
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
