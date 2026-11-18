// src/plugins/yandexSelf/logii/composables/useLogiiPager.ts

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { urlPathToSegments } from '@/utils/urlPath';
import type { LogiiRoute } from './useLogiiRoute';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';

const LOGII_PLUGIN_ID = 'yandex-self';
const PAGES_COUNT = 3;

export interface LogiiPagerDeps {
  route: LogiiRoute;
  authors: Ref<LogiiAuthorItem[]>;
  authorFolders: Ref<LogiiTrackItem[]>;
  hasAuthorIntro: Ref<boolean>;
  currentFolder: Ref<LogiiTrackItem | null>;
  goToAuthor: (author: LogiiAuthorItem) => void;
  goToFolder: (folder: LogiiTrackItem) => void;
  goToIntro: () => void;
  router: { replace: (to: RouteLocationRaw) => void };
}

export interface LogiiPager {
  pageIndex: ComputedRef<number>;
  pagesCount: number;
  canGoNext: ComputedRef<boolean>;
  canGoPrev: ComputedRef<boolean>;
  goNext: () => void;
  goPrev: () => void;
  goToPage: (index: number) => void;
}

export function useLogiiPager(deps: LogiiPagerDeps): LogiiPager {
  // Локальный стейт для мобилки: открыт ли Intro у текущего автора
  const isIntroOpen = ref(false);

  // Если сменился автор или конкретная папка, сбрасываем Intro
  watch(
    () => [deps.route.authorName.value, deps.route.folderName.value],
    () => {
      isIntroOpen.value = false;
    },
  );

  const pageIndex = computed(() => {
    if (!deps.route.seasonUrlPath.value) return 0;
    if (!deps.route.authorName.value) return 0;

    // Если мы на уровне автора (без папки в URL)
    if (!deps.route.folderName.value) {
      // Если явно открыли intro — это контент (2), иначе — список папок (1)
      return isIntroOpen.value ? 2 : 1;
    }

    return 2;
  });

  function goToSeason(): void {
    deps.router.replace({
      name: 'folder',
      params: { pluginId: LOGII_PLUGIN_ID, path: urlPathToSegments(deps.route.seasonUrlPath.value) },
    });
  }

  function goNext(): void {
    const idx = pageIndex.value;

    if (idx === 0) {
      if (deps.authors.value.length === 0) return;
      deps.goToAuthor(deps.authors.value[0]!);
      return;
    }

    if (idx === 1) {
      if (deps.hasAuthorIntro.value) {
        isIntroOpen.value = true;
        deps.goToIntro();
        return;
      }
      if (deps.authorFolders.value.length === 0) return;
      deps.goToFolder(deps.authorFolders.value[0]!);
      return;
    }
  }

  function goPrev(): void {
    const idx = pageIndex.value;

    if (idx === 2) {
      if (isIntroOpen.value) {
        isIntroOpen.value = false;
        deps.goToIntro();
        return;
      }

      if (!deps.route.authorName.value) return;
      const author = deps.authors.value.find((a) => a.folderName === deps.route.authorName.value);
      if (author) deps.goToAuthor(author);
      return;
    }

    if (idx === 1) {
      goToSeason();
      return;
    }
  }

  function goToPage(index: number): void {
    const diff = index - pageIndex.value;
    if (diff > 0) goNext();
    else if (diff < 0) goPrev();
  }

  const canGoNext = computed(() => {
    if (pageIndex.value === 0) return deps.authors.value.length > 0;
    if (pageIndex.value === 1) return deps.hasAuthorIntro.value || deps.authorFolders.value.length > 0;
    return false;
  });

  const canGoPrev = computed(() => pageIndex.value > 0);

  return {
    pageIndex,
    pagesCount: PAGES_COUNT,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    goToPage,
  };
}
