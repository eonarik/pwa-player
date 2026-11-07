// src/plugins/yandexSelf/extension.ts

import type { PluginExtension } from '../types';
import { modalService } from '@/services/ui/ModalService';
import { loadPlugin } from '../registry';
import { createPluginContext } from '../context';
import { yandexSelfService } from './YandexSelfService';
import CreateFolderModal from './logii/CreateFolderModal.vue';

export default {
  folderViews: [
    {
      pluginId: 'yandex-self',
      match: (urlPath: string) => /(?:^|\/)logii\.[^/]+(?:\/[^/]+){0,3}\/?$/.test(urlPath),
      component: () => import('./logii/LogiiView.vue'),
      props: (urlPath: string) => ({ urlPath }),
    },
  ],

  folderActions: [
    {
      id: 'create-season',
      label: 'Добавить сезон',
      tooltip: 'Создать сезон Логий в текущей папке',
      shouldShow: (folder) => folder.pluginId === 'yandex-self',
      run: async ({ folder, showToast }) => {
        const created = await modalService.show<string | null>({
          title: 'Новый сезон',
          type: 'custom',
          component: CreateFolderModal,
          props: {
            title: 'Новый сезон',
            label: 'Имя сезона',
            placeholder: '',
            namePrefix: 'logii.',
            validateName: (name: string) => {
              if (!name.trim()) return 'Введите имя сезона';
              if (/[\\/:*?"<>|]/.test(name)) return 'Имя не должно содержать \\ / : * ? " < > |';
              if (name.startsWith('logii.')) return 'Не добавляйте префикс logii. — он добавится автоматически';
              return null;
            },
            onSubmit: async (finalName: string) => {
              try {
                await yandexSelfService.createFolder(folder.urlPath, finalName);
              } catch (err) {
                throw err instanceof Error ? err : new Error('Не удалось создать сезон');
              }

              // Force-скан родителя, чтобы library.folders увидел новую папку.
              const plugin = await loadPlugin('yandex-self');
              if (plugin.scanFolder) {
                const context = createPluginContext('yandex-self');
                await plugin.scanFolder(context, folder.id, { recursive: false, force: true });
              }

              const fullPath = folder.urlPath ? `${folder.urlPath}/${finalName}` : finalName;
              showToast(`Сезон «${finalName}» создан`, 'success');
              return fullPath;
            },
          },
          disableBackdropClose: true,
        });

        if (created) {
          return { kind: 'navigate', pluginId: 'yandex-self', urlPath: created };
        }
        return { kind: 'noop' };
      },
    },
  ],
} satisfies PluginExtension;
