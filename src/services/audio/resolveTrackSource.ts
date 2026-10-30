// src/services/audio/resolveTrackSource.ts

import { apiClient } from '@/services/api/ApiClient';
import { pluginIdFromSource } from '@/plugins/registry';
import { loadPlugin } from '@/plugins/registry';
import type { Track, TrackSource } from '@/types/track';

/**
 * Возвращает источник для `<audio>` для КОНКРЕТНОГО TrackSource:
 * - `File` для local-source (через handle.getFile());
 * - строку URL для cloud-source (через plugin.buildStreamUrl) и streaming-source (url).
 *
 * Кидает AuthError, если сессия провайдера истекла (для cloud).
 */
export async function resolveTrackSource(track: Track, source: TrackSource): Promise<string | File> {
  if (source.kind === 'local') {
    try {
      console.log('[resolveTrackSource] Getting file from handle:', source.handle.name);
      const file = await source.handle.getFile();
      console.log('[resolveTrackSource] Got file:', file.name, file.size);
      return file;
    } catch (err) {
      console.error('[resolveTrackSource] Failed to get file:', err);
      throw err;
    }
  }

  if (source.kind === 'cloud') {
    const pluginId = pluginIdFromSource(source.pluginId);
    // Проверяем/обновляем сессию
    await apiClient.ensureAuth(pluginId);
    // Спрашиваем у плагина URL
    const plugin = await loadPlugin(pluginId);
    const url = plugin.buildStreamUrl(source);
    if (!url) {
      throw new Error(`[resolveTrackSource] plugin "${pluginId}" returned empty URL`);
    }
    return url;
  }

  if (source.kind === 'streaming') {
    return source.url;
  }

  // Не должно произойти (discriminated union)
  const exhaustive: never = source;
  throw new Error(`[resolveTrackSource] unknown source kind: ${JSON.stringify(exhaustive)}`);
}
