// src/stores/library/store/reconcile.ts

import type { FolderId, TrackId } from '@/types/ids';
import type { LibraryRefs } from './state';
import { isFolderSource } from '@/services/library/selectors';
import { logger } from '@/utils/logger';

export function createLibraryReconcile(refs: LibraryRefs) {
  const { tracks, folders } = refs;

  /**
   * Синхронизация связей `folder.trackIds` ↔ `source.folderId`.
   *
   * - если source.folderId указывает на несуществующую папку — удаляем source;
   * - если у трека есть source с folderId, но в папке его нет — добавляем в trackIds;
   * - если папка ссылается на трек без source с этим folderId — убираем из trackIds.
   *
   * НЕ удаляет треки. Только чинит связи.
   */
  function reconcileFolderTrackIds(): void {
    // 1. Чистим sources с битым folderId.
    for (const track of Object.values(tracks.value)) {
      const nextSources = track.sources.filter((s) => {
        if (isFolderSource(s) && !folders.value[s.folderId]) {
          logger.warn(
            `[reconcile] track "${track.title}" has source in unknown folder "${s.folderId}", removing source`,
          );
          return false;
        }
        return true;
      });

      if (nextSources.length !== track.sources.length) {
        tracks.value[track.id] = { ...track, sources: nextSources };
      }
    }

    // 2. Индекс folderId → trackId за один проход по трекам.
    //    Раньше для каждой папки обходили все треки: O(папки × треки).
    const trackIdsByFolder = new Map<FolderId, TrackId[]>();
    for (const track of Object.values(tracks.value)) {
      const foldersOfTrack = new Set<FolderId>();
      for (const source of track.sources) {
        if (!isFolderSource(source)) continue;
        if (foldersOfTrack.has(source.folderId)) continue;
        foldersOfTrack.add(source.folderId);

        const bucket = trackIdsByFolder.get(source.folderId);
        if (bucket) bucket.push(track.id);
        else trackIdsByFolder.set(source.folderId, [track.id]);
      }
    }

    // 3. Перезаписываем trackIds только там, где порядок или состав изменились.
    for (const folder of Object.values(folders.value)) {
      const nextTrackIds = trackIdsByFolder.get(folder.id) ?? [];
      const currentIds = folder.trackIds;

      const same = currentIds.length === nextTrackIds.length && currentIds.every((id, i) => id === nextTrackIds[i]);
      if (same) continue;

      folders.value[folder.id] = { ...folder, trackIds: nextTrackIds };
    }
  }

  return { reconcileFolderTrackIds };
}
