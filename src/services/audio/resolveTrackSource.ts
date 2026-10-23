// src/services/audio/resolveTrackSource.ts

import type { Track } from '@/types/track'

/**
 * Возвращает источник для `<audio>`:
 * - `File` для локальных копий (через `handle.getFile()`);
 * - строку URL для remote-only.
 *
 * Бросает, если ни `handle`, ни `source` не заданы.
 */
export async function resolveTrackSource(track: Track): Promise<string | File> {
  if (track.handle) {
    try {
      return await track.handle.getFile()
    } catch (err) {
      console.warn(
        `[resolveTrackSource] handle.getFile() failed for "${track.id}", falling back to source`,
        err,
      )
    }
  }

  if (track.source && track.source.length > 0) {
    return track.source
  }

  throw new Error(`[resolveTrackSource] track "${track.id}" has neither handle nor source`)
}
