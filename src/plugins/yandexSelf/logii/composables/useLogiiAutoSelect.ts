// src/plugins/yandexSelf/logii/composables/useLogiiAutoSelect.ts

import { watch, type Ref } from 'vue';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';

export interface UseLogiiAutoSelectDeps {
  authors: Ref<LogiiAuthorItem[]>;
  authorFolders: Ref<LogiiTrackItem[]>;
  authorName: Ref<string | null>;
  folderName: Ref<string | null>;
  hasAuthorIntro: Ref<boolean>;
  isMobile: Ref<boolean>;
  goToAuthor: (author: LogiiAuthorItem) => void;
  goToFolder: (folder: LogiiTrackItem) => void;
}

/**
 * Автовыбор автора и папки при заходе в сезон.
 *
 * На десктопе: первый заход — выбрать первого автора; смена автора —
 * выбрать первую папку. На мобильном автовыбор отключён: пользователь
 * сам выбирает через свайп/кнопки (иначе свайп-навигация теряет смысл —
 * пользователь сразу оказывается на контенте, не увидев списков).
 */
export function useLogiiAutoSelect(deps: UseLogiiAutoSelectDeps): void {
  watch(
    () => [deps.authors.value.length, deps.authorName.value, deps.folderName.value] as const,
    ([count, author, folder], prev) => {
      if (deps.isMobile.value) return;

      // 1. Первый заход в сезон — выбрать первого автора.
      if (!author && count > 0) {
        deps.goToAuthor(deps.authors.value[0]!);
        return;
      }

      // 2. Автовыбор папки:
      //    - если сменился автор (клик на другого) — выбираем первую папку;
      //    - если автор тот же, а папка стала null (refresh удалил папку) — не выбираем.
      if (author && !folder) {
        const prevAuthor = prev?.[1] ?? null;
        const prevFolder = prev?.[2] ?? null;

        if (prevAuthor === author && prevFolder !== null) return;

        if (deps.authorFolders.value.length === 0) return;
        if (deps.hasAuthorIntro.value) return;
        deps.goToFolder(deps.authorFolders.value[0]!);
      }
    },
    { immediate: true },
  );
}
