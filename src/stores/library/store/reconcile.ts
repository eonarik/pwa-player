// src/stores/library/store/reconcile.ts

import type { TrackId } from '@/types/ids';
import type { LibraryRefs } from './state';

export function createLibraryReconcile(refs: LibraryRefs) {
  const { tracks, folders } = refs;

  /**
   * Синхронизация связей `folder.trackIds` ↔ `source.folderId`.
   *
   * - если source.folderId указывает на несуществующую папку — удаляем source;
   * - если папка ссылается на трек без source с этим folderId — удаляем из trackIds;
   * - если у трека есть source с folderId, но в папке его нет — добавляем в trackIds.
   *
   * НЕ удаляет треки. Только чинит связи.
   */
  function reconcileFolderTrackIds(): void {
    let changed = false;

    // 1. Чистим sources с битым folderId.
    for (const track of Object.values(tracks.value)) {
      const nextSources = track.sources.filter((s) => {
        if (s.kind === 'local' || s.kind === 'cloud') {
          if (!folders.value[s.folderId]) {
            console.warn(
              `[reconcile] track "${track.title}" has source in unknown folder "${s.folderId}", removing source`,
            );
            return false;
          }
        }
        return true;
      });

      if (nextSources.length !== track.sources.length) {
        tracks.value[track.id] = { ...track, sources: nextSources };
        changed = true;
      }
    }

    // 2. Синхронизируем folder.trackIds.
    for (const folder of Object.values(folders.value)) {
      const nextTrackIds: TrackId[] = [];
      const seen = new Set<TrackId>();

      for (const track of Object.values(tracks.value)) {
        const belongs = track.sources.some(
          (s) => (s.kind === 'local' || s.kind === 'cloud') && s.folderId === folder.id,
        );
        if (belongs && !seen.has(track.id)) {
          seen.add(track.id);
          nextTrackIds.push(track.id);
        }
      }

      for (const id of folder.trackIds) {
        if (seen.has(id)) continue;
        if (!tracks.value[id]) continue;
        const belongs = tracks.value[id].sources.some(
          (s) => (s.kind === 'local' || s.kind === 'cloud') && s.folderId === folder.id,
        );
        if (belongs) {
          seen.add(id);
          nextTrackIds.push(id);
        }
      }

      const currentIds = folder.trackIds;
      if (currentIds.length !== nextTrackIds.length || currentIds.some((id, i) => id !== nextTrackIds[i])) {
        folders.value[folder.id] = { ...folder, trackIds: nextTrackIds };
        changed = true;
      }
    }

    if (changed) {
      console.info('[reconcile] folder.trackIds synchronized with sources');
    }
  }

  return { reconcileFolderTrackIds };
}
