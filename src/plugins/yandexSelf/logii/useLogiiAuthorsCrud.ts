// src/plugins/yandexSelf/logii/useLogiiAuthorsCrud.ts

import { modalService } from '@/services/ui/ModalService';
import { toastService } from '@/services/ui/ToastService';
import { urlPathToSegments } from '@/utils/urlPath';
import CreateFolderModal from './CreateFolderModal.vue';
import { yandexSelfService } from '../YandexSelfService';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import type { LogiiAuthorItem } from './useLogiiData';
import type { Ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import type { RouteLocationRaw } from 'vue-router';

export interface RouterApi {
  replace: (to: RouteLocationRaw) => void;
}

export interface UseLogiiAuthorsCrudDeps {
  seasonFolder: Ref<FolderRef | null>;
  currentAuthorName: Ref<string | null>;
  isWriting: Ref<boolean>;
  renameFolder: (oldUrlPath: string, newUrlPath: string) => Promise<boolean>;
  removeResource: (path: string, parentUrlPath: string) => Promise<boolean>;
  router: RouterApi;
  confirmFn?: (message: string) => boolean;
}

export interface UseLogiiAuthorsCrudResult {
  openCreateModal: () => Promise<void>;
  openRenameModal: (author: LogiiAuthorItem) => Promise<void>;
  onDeleteAuthor: (author: LogiiAuthorItem) => Promise<void>;
}

export function useLogiiAuthorsCrud({
  seasonFolder,
  currentAuthorName,
  isWriting,
  renameFolder,
  removeResource,
  router,
  confirmFn = window.confirm.bind(window),
}: UseLogiiAuthorsCrudDeps): UseLogiiAuthorsCrudResult {
  async function openCreateModal(): Promise<void> {
    if (!seasonFolder.value || isWriting.value) return;

    const season = seasonFolder.value;

    await modalService.show<string | null>({
      title: 'Новый автор',
      type: 'custom',
      component: CreateFolderModal,
      props: {
        title: 'Новый автор',
        label: 'Имя автора',
        placeholder: 'userA',
        namePrefix: '',
        submitLabel: 'Создать',
        validateName: (name: string): string | null => {
          if (!name.trim()) return 'Введите имя автора';
          if (/[\\/:*?"<>|]/.test(name)) return 'Имя не должно содержать \\ / : * ? " < > |';
          return null;
        },
        onSubmit: async (finalName: string): Promise<string | null> => {
          await yandexSelfService.createFolder(season.urlPath, finalName);

          const plugin = await loadPlugin('yandex-self');
          if (plugin.scanFolder) {
            const context = createPluginContext('yandex-self');
            await plugin.scanFolder(context, season.id, { recursive: false, force: true });
          }

          const fullPath = season.urlPath ? `${season.urlPath}/${finalName}` : finalName;
          toastService.success(`Автор «${finalName}» создан`);
          return fullPath;
        },
      },
      disableBackdropClose: true,
    });
  }

  async function openRenameModal(author: LogiiAuthorItem): Promise<void> {
    if (isWriting.value) return;

    const seasonPath = seasonFolder.value?.urlPath ?? '';
    const oldUrlPath = author.urlPath;
    const oldName = author.folderName;

    const newPathForName = (name: string): string => (seasonPath ? `${seasonPath}/${name}` : name);

    await modalService.show<string | null>({
      title: 'Переименовать автора',
      type: 'custom',
      component: CreateFolderModal,
      props: {
        title: 'Переименовать автора',
        label: 'Новое имя',
        placeholder: oldName,
        namePrefix: '',
        initialName: oldName,
        submitLabel: 'Сохранить',
        validateName: (name: string): string | null => {
          if (!name.trim()) return 'Введите имя';
          if (name === oldName) return 'Имя не изменилось';
          if (/[\\/:*?"<>|]/.test(name)) return 'Имя не должно содержать \\ / : * ? " < > |';
          return null;
        },
        onSubmit: async (newName: string): Promise<string | null> => {
          const newUrlPath = newPathForName(newName);
          const ok = await renameFolder(oldUrlPath, newUrlPath);
          if (!ok) throw new Error('Не удалось переименовать');

          if (currentAuthorName.value === oldName) {
            router.replace({
              name: 'folder',
              params: { pluginId: 'yandex-self', path: urlPathToSegments(newUrlPath) },
            });
          }

          return newUrlPath;
        },
      },
      disableBackdropClose: true,
    });
  }

  async function onDeleteAuthor(author: LogiiAuthorItem): Promise<void> {
    if (isWriting.value) return;

    const confirmed = confirmFn(`Удалить автора «${author.folderName}» и всё его содержимое? Это действие необратимо.`);
    if (!confirmed) return;

    const seasonPath = seasonFolder.value?.urlPath ?? '';
    const wasCurrent = currentAuthorName.value === author.folderName;

    const ok = await removeResource(author.urlPath, seasonPath);
    if (!ok) return;

    if (wasCurrent && seasonFolder.value) {
      router.replace({
        name: 'folder',
        params: { pluginId: 'yandex-self', path: urlPathToSegments(seasonFolder.value.urlPath) },
      });
    }
  }

  return { openCreateModal, openRenameModal, onDeleteAuthor };
}
