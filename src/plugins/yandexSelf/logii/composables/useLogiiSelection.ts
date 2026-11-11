// src/plugins/yandexSelf/logii/composables/useLogiiSelection.ts

import { computed, type ComputedRef } from 'vue';
import type { FolderRef } from '@/types/folder';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';
import type { UseLogiiSeasonResult } from '../useLogiiData';
import type { LogiiRoute } from './useLogiiRoute';

const LOGII_PLUGIN_ID = 'yandex-self';

export interface LogiiSelection {
  currentAuthor: ComputedRef<LogiiAuthorItem | null>;
  authorFolders: ComputedRef<LogiiTrackItem[]>;
  authorIntro: ComputedRef<LogiiTrackItem | null>;
  hasAuthorIntro: ComputedRef<boolean>;
  authorIntroFileName: ComputedRef<string | null>;
  currentFolder: ComputedRef<LogiiTrackItem | null>;
  currentFolderUrlPath: ComputedRef<string>;
  currentLogiiFileName: ComputedRef<string | null>;
  currentAuthorFolder: ComputedRef<FolderRef | null>;
}

export function useLogiiSelection(
  season: UseLogiiSeasonResult,
  route: LogiiRoute,
  folders: ComputedRef<Record<string, FolderRef>>,
): LogiiSelection {
  const currentAuthor = computed<LogiiAuthorItem | null>(() => {
    if (!route.authorName.value) return null;
    return season.authors.value.find((a) => a.folderName === route.authorName.value) ?? null;
  });

  const authorFolders = computed<LogiiTrackItem[]>(() => {
    if (!currentAuthor.value) return [];
    return season.tracksByAuthor.value.get(currentAuthor.value.urlPath) ?? [];
  });

  const authorIntro = computed<LogiiTrackItem | null>(() => {
    if (!currentAuthor.value) return null;
    return season.authorMeta.value.get(currentAuthor.value.urlPath) ?? null;
  });

  const hasAuthorIntro = computed(() => Boolean(authorIntro.value?.logiiFileName));
  const authorIntroFileName = computed(() => authorIntro.value?.logiiFileName ?? null);

  const currentFolder = computed<LogiiTrackItem | null>(() => {
    if (!route.authorName.value) return null;
    if (!route.folderName.value) {
      return hasAuthorIntro.value ? authorIntro.value : null;
    }
    return authorFolders.value.find((f) => f.folderName === route.folderName.value) ?? null;
  });

  const currentFolderUrlPath = computed(() => currentFolder.value?.urlPath ?? '');
  const currentLogiiFileName = computed(() => currentFolder.value?.logiiFileName ?? null);

  const currentAuthorFolder = computed<FolderRef | null>(() => {
    if (!currentAuthor.value) return null;
    for (const f of Object.values(folders.value)) {
      if (f.pluginId === LOGII_PLUGIN_ID && f.urlPath === currentAuthor.value.urlPath) return f;
    }
    return null;
  });

  return {
    currentAuthor,
    authorFolders,
    authorIntro,
    hasAuthorIntro,
    authorIntroFileName,
    currentFolder,
    currentFolderUrlPath,
    currentLogiiFileName,
    currentAuthorFolder,
  };
}
