// src/services/audio/resolveTrackSource.ts

import { apiClient } from '@/services/api/ApiClient'
import { pluginIdFromSource } from '@/plugins/registry'
import type { Track } from '@/types/track'

/**
 * Возвращает источник для `<audio>`:
 * - `File` для локальных копий (через `handle.getFile()`);
 * - строку URL для remote-only.
 *
 * Для remote-only перед возвратом URL делает `apiClient.ensureAuth(pluginId)`.
 * Если сессия провайдера мертва и не восстанавливается — бросает AuthError.
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
    // Для remote-only — проверяем/обновляем сессию провайдера.
    // Если провайдер не поддерживает AuthProvider (например, `local`),
    // ensureAuth — no-op.
    if (track.pluginId) {
      const pluginId = pluginIdFromSource(track.pluginId)
      await apiClient.ensureAuth(pluginId)
    }
    return track.source
  }

  throw new Error(`[resolveTrackSource] track "${track.id}" has neither handle nor source`)
}
