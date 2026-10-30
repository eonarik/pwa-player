// src/services/persistence/restore.ts

import type { Track } from '@/types/track';
import type { PersistedTrack } from './types';

export async function restoreTrack(persisted: PersistedTrack): Promise<Track | null> {
  return {
    id: persisted.id,
    pluginId: persisted.pluginId,
    artist: persisted.artist,
    title: persisted.title,
    albumId: persisted.albumId,
    coverUrl: persisted.coverUrl,
    sources: persisted.sources,
    metadataCandidates: persisted.metadataCandidates ?? [],
    raw: persisted.raw ?? null,
    hasId3Tags: persisted.hasId3Tags ?? false,
    duration: persisted.duration,
    codec: persisted.codec,
    trackNumber: persisted.trackNumber,
    year: persisted.year,
    genre: persisted.genre,
  };
}

export async function restoreTracks(persisted: PersistedTrack[], concurrency = 8): Promise<Track[]> {
  const results: Track[] = Array.from({ length: persisted.length });
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < persisted.length) {
      const index = cursor++;
      const track = await restoreTrack(persisted[index]!);
      if (track) results[index] = track;
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, persisted.length) }, () => worker()));

  return results.filter(Boolean);
}
