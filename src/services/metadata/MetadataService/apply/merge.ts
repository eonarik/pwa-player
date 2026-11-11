// src/services/metadata/MetadataService/apply/merge.ts

import { createLibraryWriter } from '@/stores/library';
import { usePlaylistsStore } from '@/stores/playlists';
import { useHistoryStore } from '@/stores/history';
import { useDislikesStore } from '@/stores/dislikes';
import { isSameSource } from '@/services/library/TrackMerger';
import type { Track, TrackSource } from '@/types/track';
import type { TrackId } from '@/types/ids';

/** Объединение источников двух треков: без дублей, по возрастанию priority. */
function mergeSources(primary: TrackSource[], secondary: TrackSource[]): TrackSource[] {
  const unique: TrackSource[] = [];

  for (const source of [...primary, ...secondary]) {
    if (!unique.some((existing) => isSameSource(existing, source))) {
      unique.push(source);
    }
  }

  return unique.sort((a, b) => a.priority - b.priority);
}

/**
 * Перенос временной отметки (история/дизлайки) с удалённого трека на целевой.
 * Своя отметка у целевого важнее — не затираем.
 */
function repointTimestamp(map: Record<TrackId, number>, fromId: TrackId, toId: TrackId): void {
  const timestamp = map[fromId];
  if (timestamp === undefined) return;

  if (map[toId] === undefined) {
    map[toId] = timestamp;
  }
  delete map[fromId];
}

/**
 * Слияние дубля трека: `source` переезжает в `target`.
 *
 * 1. Объединяем источники (target + source).
 * 2. Заменяем trackId в плейлистах/истории/дизлайках.
 * 3. Удаляем трек-дубль.
 *
 * `reconcile` такой замены для произвольных треков не делает — перевешиваем
 * ссылки вручную. Метаданные целевому треку применяет вызывающий.
 */
export function mergeTrackInto(source: Track, target: Track): void {
  const writer = createLibraryWriter();

  writer.updateTrackSources(target.id, mergeSources(target.sources, source.sources));

  const playlists = usePlaylistsStore();
  for (const playlist of Object.values(playlists.playlists)) {
    const index = playlist.trackIds.indexOf(source.id);
    if (index === -1) continue;

    playlist.trackIds[index] = target.id;
    playlist.trackIds = Array.from(new Set(playlist.trackIds));
    playlist.updatedAt = Date.now();
  }
  playlists.save();

  repointTimestamp(useHistoryStore().history.playedAt, source.id, target.id);
  repointTimestamp(useDislikesStore().dislikes.dislikedAt, source.id, target.id);

  writer.removeTrack(source.id);
}
