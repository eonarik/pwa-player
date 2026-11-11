// src/plugins/yandexSelf/logii/composables/useLogiiRoute.ts

import { computed, type ComputedRef, type Ref } from 'vue';

export interface LogiiRoute {
  segments: ComputedRef<string[]>;
  seasonIndex: ComputedRef<number>;
  seasonUrlPath: ComputedRef<string>;
  authorName: ComputedRef<string | null>;
  folderName: ComputedRef<string | null>;
}

/**
 * Разбор urlPath вида `<...>/logii.<season>/<author>/<folder>`.
 * Сегменты до маркера сезона — путь родителя, `logii.*` — сам сезон.
 */
export function useLogiiRoute(urlPath: Ref<string>): LogiiRoute {
  const segments = computed(() => urlPath.value.split('/').filter(Boolean));
  const seasonIndex = computed(() => segments.value.findIndex((s) => s.startsWith('logii.')));

  const seasonUrlPath = computed(() => {
    if (seasonIndex.value === -1) return '';
    return segments.value.slice(0, seasonIndex.value + 1).join('/');
  });

  const authorName = computed<string | null>(() => {
    if (seasonIndex.value === -1) return null;
    return segments.value[seasonIndex.value + 1] ?? null;
  });

  const folderName = computed<string | null>(() => {
    if (seasonIndex.value === -1) return null;
    return segments.value[seasonIndex.value + 2] ?? null;
  });

  return { segments, seasonIndex, seasonUrlPath, authorName, folderName };
}
