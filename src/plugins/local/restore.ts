// src/plugins/local/restore.ts

import type { PersistedLocalTrack } from './types'
import type { Track } from '@/types/track'

export async function restoreTrack(persisted: PersistedLocalTrack): Promise<Track | null> {
  const base: Omit<Track, 'source'> = {
    id: persisted.id,
    pluginId: persisted.pluginId,
    title: persisted.title,
    artist: persisted.artist,
    album: persisted.album,
    year: persisted.year,
    trackNumber: persisted.trackNumber,
    genre: persisted.genre,
    duration: persisted.duration,
    codec: persisted.codec,
    filename: persisted.filename,
    path: persisted.path,
    handle: persisted.handle,
  }

  if (!persisted.handle) {
    return { ...base, source: '' }
  }

  try {
    const file = await persisted.handle.getFile()
    return { ...base, source: file }
  } catch (err) {
    console.warn(`[local-plugin] can't read file for "${persisted.title}"`, err)
    return { ...base, source: '' }
  }
}

async function restoreBaseTracks(
  persisted: PersistedLocalTrack[],
  concurrency = 8,
): Promise<Track[]> {
  const results: Track[] = new Array(persisted.length)
  let cursor = 0

  const worker = async (): Promise<void> => {
    while (cursor < persisted.length) {
      const index = cursor++
      const track = await restoreTrack(persisted[index]!)
      if (track) results[index] = track
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, persisted.length) }, () => worker()))

  return results.filter(Boolean)
}

/**
 * Восстанавливает треки очереди плеера из PersistedLocalTrack[].
 * Обложки подтягивает ядро через CoverPersistenceService.
 */
export async function restoreTracks(
  persisted: PersistedLocalTrack[],
  concurrency = 8,
): Promise<Track[]> {
  return restoreBaseTracks(persisted, concurrency)
}
