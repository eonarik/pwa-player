// src/plugins/yandexSelf/logii/composables/useLogiiNavigation.ts

import { computed, type ComputedRef } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import type { FolderRef } from '@/types/folder';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';
import type { LogiiRoute } from './useLogiiRoute';
import { resolveSeasonParentUrlPath } from '../navigation';
import { urlPathToSegments } from '@/utils/urlPath';

const LOGII_PLUGIN_ID = 'yandex-self';

export interface LogiiRouter {
  push(to: RouteLocationRaw): void;
  replace(to: RouteLocationRaw): void;
}

export interface LogiiNavigation {
  canGoToParent: ComputedRef<boolean>;
  goToParent: () => void;
  goToAuthor: (author: LogiiAuthorItem) => void;
  goToIntro: () => void;
  goToFolder: (folder: LogiiTrackItem) => void;
}

export interface LogiiNavigationDeps {
  route: LogiiRoute;
  currentAuthor: ComputedRef<LogiiAuthorItem | null>;
  folders: ComputedRef<Record<string, FolderRef>>;
  router: LogiiRouter;
}

export function useLogiiNavigation(deps: LogiiNavigationDeps): LogiiNavigation {
  const canGoToParent = computed(() => Boolean(deps.route.seasonUrlPath.value));

  function goToParent(): void {
    if (!deps.route.seasonUrlPath.value) {
      deps.router.push({ name: 'folder', params: { pluginId: LOGII_PLUGIN_ID, path: [] } });
      return;
    }
    const parentUrlPath = resolveSeasonParentUrlPath(deps.route.seasonUrlPath.value, deps.folders.value);
    deps.router.push({
      name: 'folder',
      params: { pluginId: LOGII_PLUGIN_ID, path: urlPathToSegments(parentUrlPath) },
    });
  }

  function goToAuthor(author: LogiiAuthorItem): void {
    const baseSegments = deps.route.segments.value.slice(0, deps.route.seasonIndex.value + 1);
    deps.router.replace({
      name: 'folder',
      params: { pluginId: LOGII_PLUGIN_ID, path: [...baseSegments, author.folderName] },
    });
  }

  function goToIntro(): void {
    if (!deps.currentAuthor.value) return;
    goToAuthor(deps.currentAuthor.value);
  }

  function goToFolder(folder: LogiiTrackItem): void {
    if (!deps.route.authorName.value) return;
    const baseSegments = deps.route.segments.value.slice(0, deps.route.seasonIndex.value + 1);
    deps.router.replace({
      name: 'folder',
      params: {
        pluginId: LOGII_PLUGIN_ID,
        path: [...baseSegments, deps.route.authorName.value, folder.folderName],
      },
    });
  }

  return { canGoToParent, goToParent, goToAuthor, goToIntro, goToFolder };
}
