// src/plugins/yandexSelf/logii/useYandexSelfWrites.ts

import { ref } from 'vue';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { yandexSelfService } from '../YandexSelfService';
import { markPendingDelete, markPendingMove } from './composables/useLogiiChanges';
import { toastService } from '@/services/ui/ToastService';
import type { FolderId } from '@/types/ids';
import { logger } from '@/utils/logger';

export function useYandexSelfWrites() {
  const isWriting = ref(false);

  /**
   * После любой write-операции: force-скан родительской папки.
   * Нужно, чтобы library.folders / library.tracks отразили изменения с Диска.
   */
  async function refreshAfterWrite(parentFolderId: FolderId): Promise<void> {
    const plugin = await loadPlugin('yandex-self');
    if (!plugin.scanFolder) return;

    const context = createPluginContext('yandex-self');
    await plugin.scanFolder(context, parentFolderId, { recursive: false, force: true });
  }

  /**
   * Создаёт сезон `logii.<name>` в `parentUrlPath`.
   * После — force-скан родителя + переход в новый сезон.
   */
  async function createSeason(parentUrlPath: string, name: string): Promise<string | null> {
    if (isWriting.value) return null;
    isWriting.value = true;

    try {
      const finalName = `logii.${name}`;
      const fullPath = parentUrlPath ? `${parentUrlPath}/${finalName}` : finalName;

      await yandexSelfService.createFolder(parentUrlPath, finalName);

      // Найти folderId родителя для force-скана
      // (после write — пересканируем родителя).
      const lib = (await import('@/stores/library')).useLibraryStore();
      const parentFolder = Object.values(lib.folders).find(
        (f) => f.pluginId === 'yandex-self' && f.urlPath === parentUrlPath,
      );

      if (parentFolder) {
        await refreshAfterWrite(parentFolder.id);
      }

      toastService.success(`Сезон «${name}» создан`);
      return fullPath;
    } catch (err) {
      logger.error('[create-season] failed', err);
      toastService.error(err instanceof Error ? err.message : 'Не удалось создать сезон');
      return null;
    } finally {
      isWriting.value = false;
    }
  }

  /**
   * Переименовывает папку и обновляет library точечно.
   * `oldUrlPath` / `newUrlPath` — без ведущего слэша.
   */
  async function renameFolder(oldUrlPath: string, newUrlPath: string): Promise<boolean> {
    if (isWriting.value) return false;
    isWriting.value = true;

    try {
      // CUEI-0022: переименование — штатная операция, следующий скан не должен
      // выдавать перемещённые файлы за removed+added
      markPendingMove(oldUrlPath, newUrlPath);

      await yandexSelfService.moveResource(oldUrlPath, newUrlPath);

      const writer = (await import('@/stores/library')).createLibraryWriter();
      await writer.renameFolderSubtree(oldUrlPath, newUrlPath);

      toastService.success('Переименовано');
      return true;
    } catch (err) {
      logger.error('[rename-folder] failed', err);
      toastService.error(err instanceof Error ? err.message : 'Не удалось переименовать');
      return false;
    } finally {
      isWriting.value = false;
    }
  }

  /**
   * Удаляет ресурс (файл/папку) и пересканирует родителя.
   */
  async function removeResource(path: string, parentUrlPath: string): Promise<boolean> {
    if (isWriting.value) return false;
    isWriting.value = true;

    try {
      // CUEI-0022: штатное удаление не должно попадать в removed-события
      // ближайшего refresh-скана сезона
      markPendingDelete(path);

      await yandexSelfService.removeResource(path);

      const lib = (await import('@/stores/library')).useLibraryStore();
      const parentFolder = Object.values(lib.folders).find(
        (f) => f.pluginId === 'yandex-self' && f.urlPath === parentUrlPath,
      );

      if (parentFolder) {
        await refreshAfterWrite(parentFolder.id);
      }

      toastService.success('Удалено');
      return true;
    } catch (err) {
      logger.error('[remove-resource] failed', err);
      toastService.error(err instanceof Error ? err.message : 'Не удалось удалить');
      return false;
    } finally {
      isWriting.value = false;
    }
  }

  return { isWriting, createSeason, renameFolder, removeResource };
}
