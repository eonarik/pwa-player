// src/stores/library/store/persist.ts

import { watch } from 'vue';
import { set } from 'idb-keyval';
import { toRaw } from 'vue';
import { albumService } from '@/services/persistence/AlbumService';
import type { LibraryRefs } from './state';

const LIBRARY_KEY = 'player:library';

function deepToRaw<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(deepToRaw) as unknown as T;
  if (typeof window !== 'undefined' && (obj instanceof FileSystemFileHandle || obj instanceof Blob)) {
    return obj;
  }

  const raw = toRaw(obj);
  const result: Record<string, unknown> = {};
  for (const key in raw) {
    result[key] = deepToRaw((raw as Record<string, unknown>)[key]);
  }
  return result as T;
}

export function setupPersistence(refs: LibraryRefs): void {
  const { tracks, folders, albums } = refs;

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  watch(albums, () => void albumService.saveAll(albums.value), { deep: true });

  watch(
    [tracks, folders],
    () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveTimeout = null;
        // Откладываем выполнение deepToRaw и set на следующий тик,
        // чтобы Vue успел отрисовать кадр (разгружаем Main Thread)
        requestIdleCallback(() => {
          try {
            const rawData = {
              tracks: deepToRaw(tracks.value),
              folders: deepToRaw(folders.value),
            };
            void set(LIBRARY_KEY, rawData);
          } catch (err) {
            console.warn('[library] failed to persist library', err);
          }
        });
      }, 1000); // Дебаунс 1 сек
    },
    { deep: true },
  );
}
