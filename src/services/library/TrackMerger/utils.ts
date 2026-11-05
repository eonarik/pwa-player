// src/services/library/TrackMerger/utils.ts

import type { Track, TrackSource } from '@/types/track';
import type { PluginTrackPayload } from '@/types/plugin';
import { normalizeMatchString } from '@/services/playlists/PlaylistMatcher';

export function isSameSource(a: TrackSource, b: TrackSource): boolean {
  if (a.pluginId !== b.pluginId) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'local' && b.kind === 'local') {
    return a.handle.name === b.handle.name && a.folderId === b.folderId;
  }
  if (a.kind === 'cloud' && b.kind === 'cloud') {
    return a.remotePath === b.remotePath;
  }
  if (a.kind === 'streaming' && b.kind === 'streaming') {
    return a.url === b.url && a.url !== '';
  }
  return false;
}

/**
 * "Строгое" совпадение: нормализованные artist и title равны.
 * Используется в TrackMerger.merge, чтобы решить merged-strict vs merged-soft.
 *
 * Обрати внимание: title с суффиксом "(Official Video)" — это НЕ strict,
 * это soft (кандидат). Пользователь решает через MetadataCandidatesModal.
 */
export function isStrictMatch(incoming: Track, existing: Track): boolean {
  return (
    normalizeMatchString(incoming.artist) === normalizeMatchString(existing.artist) &&
    normalizeMatchString(incoming.title) === normalizeMatchString(existing.title)
  );
}

export function trackToPayload(track: Track): PluginTrackPayload {
  const firstSource = track.sources[0];
  if (!firstSource) {
    throw new Error(`[TrackMerger] track "${track.id}" has no sources`);
  }
  const { id: _id, ...sourceWithoutId } = firstSource;
  return {
    artist: track.artist,
    title: track.title,
    album: track.raw?.album ?? '',
    coverUrl: track.coverUrl ?? track.raw?.coverUrl ?? null,
    duration: track.duration,
    codec: track.codec,
    hasId3Tags: track.hasId3Tags,
    provider: undefined,
    source: sourceWithoutId,
  };
}

export function buildLibraryIndex(tracks: Track[]): Map<string, Track[]> {
  const index = new Map<string, Track[]>();
  for (const track of tracks) {
    const artistKey = normalizeMatchString(track.artist);
    const list = index.get(artistKey) || [];
    list.push(track);
    index.set(artistKey, list);
  }
  return index;
}
