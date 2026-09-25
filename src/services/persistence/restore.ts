// src/services/persistence/restore.ts

import { fileSystemService } from '../filesystem/FileSystemService'
import type { PersistedTrack } from './types'
import type { Track } from '@/types/track'

/**
 * Восстанавливает Track из PersistedTrack.
 * Пытается получить актуальный File через handle.
 * Если handle нет или доступ потерян — возвращает трек без source (его нельзя играть).
 */
export async function restoreTrack(persisted: PersistedTrack): Promise<Track | null> {
  const base: Omit<Track, 'source'> = {
    id: persisted.id,
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
    directoryHandle: persisted.directoryHandle, // ← добавить
  }

  if (!persisted.handle) {
    // Нет handle — трек неиграбельный, но показываем как «битый»
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

/**
 * Восстанавливает весь список.
 * Параллельно, но с ограничением — getFile() на 1000 файлах задушит вкладку.
 */
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

  // Группируем по directoryHandle и ищем обложки
  const coverCache = new Map<FileSystemDirectoryHandle, File | null>()

  for (const track of tracks) {
    if (!track.directoryHandle) continue
    if (!coverCache.has(track.directoryHandle)) {
      const cover = await fileSystemService.findCoverInDirectory(track.directoryHandle)
      coverCache.set(track.directoryHandle, cover)
    }
    const cover = coverCache.get(track.directoryHandle)
    if (cover) {
      track.coverUrl = URL.createObjectURL(cover)
    }
  }

  return tracks
}
