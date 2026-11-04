// src/stores/library/store/persist.ts

import { watch } from 'vue';
import { set } from 'idb-keyval';
import { albumService } from '@/services/persistence/AlbumService';
import { telemetry } from '@/services/telemetry';
import { deepToRaw } from '@/utils/deepToRaw';
import type { LibraryRefs } from './state';

const LIBRARY_KEY = 'player:library';

let pendingData: { tracks: unknown; folders: unknown } | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function writeNow(): void {
  if (!pendingData) return;
  const data = pendingData;
  pendingData = null;
  try {
    void set(LIBRARY_KEY, data);
  } catch (err) {
    console.warn('[library] failed to persist library', err);
  }
}

export function flushLibrary(): void {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  writeNow();
}

export function setupPersistence(refs: LibraryRefs): void {
  const { tracks, folders, albums } = refs;

  watch(albums, () => albumService.save(albums.value), { deep: true });

  watch(
    [tracks, folders],
    () => {
      // Заполняем pendingData синхронно (чтобы flushLibrary успел записать).
      try {
        pendingData = {
          tracks: deepToRaw(tracks.value),
          folders: deepToRaw(folders.value),
        };
        const sizeKB = Math.round(JSON.stringify(pendingData).length / 1024);
        telemetry.event('idb.write.pending', { key: LIBRARY_KEY, sizeKB });
      } catch (err) {
        console.warn('[library] failed to snapshot library', err);
        return;
      }

      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveTimeout = null;
        requestIdleCallback(() => writeNow());
      }, 1000);
    },
    { deep: true },
  );
}
