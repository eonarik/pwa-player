// src/plugins/yandexSelf/logii/composables/useLogiiRefresh.ts

import { ref, type ComputedRef, type Ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import type { LogiiRouter } from './useLogiiNavigation';
import type { LogiiRoute } from './useLogiiRoute';
import { resolveLogiiNavigationAfterRefresh } from '../navigation';
import { urlPathToSegments } from '@/utils/urlPath';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { toastService } from '@/services/ui/ToastService';
import { logger } from '@/utils/logger';

const LOGII_PLUGIN_ID = 'yandex-self';

export interface LogiiRefreshDeps {
  seasonFolder: Ref<FolderRef | null>;
  route: LogiiRoute;
  folders: ComputedRef<Record<string, FolderRef>>;
  router: LogiiRouter;
  reloadTrack: (force?: boolean) => Promise<void>;
}

export interface LogiiRefresh {
  isRefreshing: Ref<boolean>;
  onRefresh: () => Promise<void>;
}

export function useLogiiRefresh(deps: LogiiRefreshDeps): LogiiRefresh {
  const isRefreshing = ref(false);

  async function onRefresh(): Promise<void> {
    if (!deps.seasonFolder.value) return;
    if (isRefreshing.value) return;

    isRefreshing.value = true;
    try {
      const plugin = await loadPlugin(LOGII_PLUGIN_ID);
      if (!plugin.scanFolder) {
        toastService.error('Плагин не поддерживает сканирование');
        return;
      }
      const context = createPluginContext(LOGII_PLUGIN_ID);
      await plugin.scanFolder(context, deps.seasonFolder.value.id, { recursive: true, force: true });

      const nav = resolveLogiiNavigationAfterRefresh({
        seasonUrlPath: deps.route.seasonUrlPath.value,
        authorName: deps.route.authorName.value,
        folderName: deps.route.folderName.value,
        folders: deps.folders.value,
      });

      if (nav.level === 'root') {
        toastService.success('Обновлено с облака');
        deps.router.push({ name: 'folder', params: { pluginId: LOGII_PLUGIN_ID, path: [] } });
        return;
      }

      if (nav.level !== 'folder') {
        toastService.success('Обновлено с облака');
        deps.router.push({
          name: 'folder',
          params: { pluginId: LOGII_PLUGIN_ID, path: urlPathToSegments(nav.urlPath) },
        });
        return;
      }

      await deps.reloadTrack(true);
      toastService.success('Обновлено с облака');
    } catch (err) {
      logger.error('[logii] refresh failed', err);
      toastService.error('Не удалось обновить');
    } finally {
      isRefreshing.value = false;
    }
  }

  return { isRefreshing, onRefresh };
}
