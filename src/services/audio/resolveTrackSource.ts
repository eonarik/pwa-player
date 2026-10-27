// src/services/audio/resolveTrackSource.ts

import { apiClient } from '@/services/api/ApiClient'
import { pluginIdFromSource } from '@/plugins/registry'
import type { Track, TrackSource } from '@/types/track'

/**
 * Возвращает источник для `<audio>` для КОНКРЕТНОГО TrackSource:
 * - `File` для локальных копий (через `handle.getFile()`);
 * - строку URL для remote-only.
 */
export async function resolveTrackSource(
  track: Track,
  source: TrackSource,
): Promise<string | File> {
  // 1. Если есть handle и это приоритетный локальный файл
  if (track.handle && source.id === track.id) {
    try {
      return await track.handle.getFile()
    } catch (err) {
      console.warn(
        `[resolveTrackSource] handle.getFile() failed for "${track.id}", falling back to source`,
        err,
      )
    }
  }

  // 2. Если у источника есть URL
  if (source.url && source.url.length > 0) {
    // Для remote-only — проверяем/обновляем сессию провайдера.
    if (source.pluginId) {
      const pluginId = pluginIdFromSource(source.pluginId)
      await apiClient.ensureAuth(pluginId)
    }
    return source.url
  }

  throw new Error(`[resolveTrackSource] source "${source.id}" has no url or valid handle`)
}
