// src/stores/library/store/persist.ts

import { watch } from 'vue';
import { set } from 'idb-keyval';
import { albumService } from '@/services/persistence/AlbumService';
import { deepToRaw, type LibraryRefs } from './state';

const LIBRARY_KEY = 'player:library';

export function setupPersistence(refs: LibraryRefs): void {
  const { tracks, folders, albums } = refs;

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    [tracks, folders],
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          const rawData = {
            tracks: deepToRaw(tracks.value),
            folders: deepToRaw(folders.value),
          };
          await set(LIBRARY_KEY, rawData);
        } catch (err) {
          console.warn('[library] failed to persist library', err);
        }
      }, 1000);
    },
    { deep: true },
  );

  watch(albums, () => void albumService.saveAll(albums.value), { deep: true });
}

export async function saveLibraryNow(refs: LibraryRefs): Promise<void> {
  try {
    const rawData = {
      tracks: deepToRaw(refs.tracks.value),
      folders: deepToRaw(refs.folders.value),
    };
    await set(LIBRARY_KEY, rawData);
  } catch (err) {
    console.warn('[library] failed to persist library (now)', err);
  }
}

export { LIBRARY_KEY };
