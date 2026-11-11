// src/plugins/yandexSelf/logii/useAuthorTrackState.ts

import { computed, type Ref } from 'vue';
import type { Track } from '@/types/track';

/**
 * Вычисляет Set ID треков для автора по его urlPath.
 */
function trackIdsSet(tracks: Track[]): Set<string> {
  const ids = new Set<string>();
  for (const t of tracks) ids.add(t.id);
  return ids;
}

/**
 * Composable для playback-статуса автора.
 * Принимает реактивные зависимости и возвращает булевы функции.
 */
export interface UseAuthorTrackStateResult {
  isAuthorPlaying: (urlPath: string) => boolean;
  isAuthorCurrent: (urlPath: string) => boolean;
  hasTracks: (urlPath: string) => boolean;
}

export function useAuthorTrackState({
  allTracksByAuthor,
  currentTrackId,
  isPlaying,
}: {
  allTracksByAuthor: Ref<Map<string, Track[]>>;
  currentTrackId: Ref<string | null>;
  isPlaying: Ref<boolean>;
}): UseAuthorTrackStateResult {
  const trackIdsByAuthor = computed<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>();
    for (const [authorUrlPath, tracks] of allTracksByAuthor.value.entries()) {
      map.set(authorUrlPath, trackIdsSet(tracks));
    }
    return map;
  });

  function isAuthorPlaying(urlPath: string): boolean {
    const ids = trackIdsByAuthor.value.get(urlPath);
    if (!ids || !currentTrackId.value) return false;
    return ids.has(currentTrackId.value) && isPlaying.value;
  }

  function isAuthorCurrent(urlPath: string): boolean {
    const ids = trackIdsByAuthor.value.get(urlPath);
    if (!ids || !currentTrackId.value) return false;
    return ids.has(currentTrackId.value);
  }

  function hasTracks(urlPath: string): boolean {
    const tracks = allTracksByAuthor.value.get(urlPath);
    return Boolean(tracks && tracks.length > 0);
  }

  return { isAuthorPlaying, isAuthorCurrent, hasTracks };
}
