// src/services/persistence/restore.ts

import { findCoverInDirectory } from '@/services/covers/findCoverInDirectory'
import type { PersistedTrack } from './types'
import type { Track } from '@/types/track'

export async function restoreTrack(persisted: PersistedTrack): Promise<Track | null> {
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
    directoryHandle: persisted.directoryHandle,
  }

  if (!persisted.handle) {
    return { ...base, source: '' }
  }

  try {
    const file = await persisted.handle.getFile()
    return { ...base, source: file }
  } catch (err) {
    console.warn(`[restore] can't read file for "${persisted.title}"`, err)
    return { ...base, source: '' }
  }
}

async function restoreBaseTracks(persisted: PersistedTrack[], concurrency = 8): Promise<Track[]> {
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

export async function restoreTracks(
  persisted: PersistedTrack[],
  concurrency = 8,
): Promise<Track[]> {
  const tracks = await restoreBaseTracks(persisted, concurrency)

  // Кэшируем URL, а не File. Один folder.jpg → один blob URL на папку.
  const coverCache = new Map<FileSystemDirectoryHandle, string | null>()

  for (const track of tracks) {
    if (!track.directoryHandle) continue

    if (!coverCache.has(track.directoryHandle)) {
      const coverFile = await findCoverInDirectory(track.directoryHandle)
      coverCache.set(track.directoryHandle, coverFile ? URL.createObjectURL(coverFile) : null)
    }

    const coverUrl = coverCache.get(track.directoryHandle)
    if (coverUrl) {
      track.coverUrl = coverUrl
    }
  }

  return tracks
}
