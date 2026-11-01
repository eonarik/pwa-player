// src/services/library/TrackMerger/utils.ts

import type { Track, TrackSource } from '@/types/track';
import type { PluginTrackPayload } from '@/types/plugin';

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

export function isStrictMatch(incoming: Track, existing: Track): boolean {
  const inArtist = incoming.artist.trim().toLowerCase();
  const exArtist = existing.artist.trim().toLowerCase();
  const inTitle = incoming.title.trim().toLowerCase();
  const exTitle = existing.title.trim().toLowerCase();

  return inArtist === exArtist && inTitle === exTitle;
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
    const artistKey = (track.artist || '').trim().toLowerCase();
    const list = index.get(artistKey) || [];
    list.push(track);
    index.set(artistKey, list);
  }
  return index;
}
