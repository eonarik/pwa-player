// src/plugins/local/settings.ts

import { fileSystemService } from './FileSystemService';
import { localPersistenceService } from './persistence';
import { createLibraryWriter } from '@/stores/library';
import { toastService } from '@/services/ui/ToastService';
import type { PluginSettingsFolderEntry, PluginSettingsSchema } from '@/plugins/settingsTypes';

const PLUGIN_ID = 'local';

async function getFolderEntries(): Promise<PluginSettingsFolderEntry[]> {
  const handles = await fileSystemService.getHandles();
  const entries: PluginSettingsFolderEntry[] = [];
  for (const h of handles) {
    let status: PluginSettingsFolderEntry['status'] = 'unknown';
    try {
      const q = await h.queryPermission({ mode: 'read' });
      status = q as PluginSettingsFolderEntry['status'];
    } catch {
      status = 'unknown';
    }
    entries.push({ name: h.name, status });
  }
  return entries;
}

export async function getLocalSettingsSchema(): Promise<PluginSettingsSchema> {
  const folders = await getFolderEntries();

  return {
    sections: [
      {
        id: 'local-folders',
        title: 'Локальные папки',
        description:
          'Папки с музыкой на этом устройстве. Можно добавить несколько. Папки с одинаковыми именами перезапишут друг друга.',
        fields: [
          { type: 'folderList', id: 'folders', folders },
          {
            type: 'action',
            id: 'add-folder',
            label: 'Добавить папку',
            description: 'Выбрать папку на устройстве',
          },
        ],
      },
    ],
  };
}

export async function runLocalSettingsAction(actionId: string, payload?: unknown): Promise<void> {
  if (actionId === 'add-folder') {
    await addFolder();
    return;
  }

  if (actionId === 'rescan-folder') {
    const { name } = (payload ?? {}) as { name?: string };
    if (!name) return;
    await rescanFolder(name);
    return;
  }

  if (actionId === 'remove-folder') {
    const { name } = (payload ?? {}) as { name?: string };
    if (!name) return;
    await removeFolder(name);
    return;
  }
}

async function addFolder(): Promise<void> {
  try {
    const handle = await fileSystemService.pickDirectory();
    if (!handle) return;

    const added = await fileSystemService.addHandle(handle);
    if (!added) {
      toastService.info(`Папка «${handle.name}» уже добавлена`);
      return;
    }

    toastService.success(`Папка «${handle.name}» добавлена`);
    await rebuildAndSave();
  } catch (err) {
    console.error('[local-settings] add folder failed', err);
    toastService.error('Не удалось добавить папку');
  }
}

async function rescanFolder(name: string): Promise<void> {
  try {
    const handles = await fileSystemService.getHandles();
    const handle = handles.find((h) => h.name === name);
    if (!handle) {
      toastService.error('Папка не найдена');
      return;
    }

    const granted = await fileSystemService.verifyPermission(handle, 'read');
    if (!granted) {
      toastService.error('Нет доступа к папке');
      return;
    }

    await rebuildAndSave();
    toastService.success(`Папка «${name}» обновлена`);
  } catch (err) {
    console.error('[local-settings] rescan failed', err);
    toastService.error('Не удалось обновить папку');
  }
}

async function removeFolder(name: string): Promise<void> {
  const confirmed = window.confirm(`Удалить папку «${name}» из библиотеки?`);
  if (!confirmed) return;

  try {
    await fileSystemService.removeHandle(name);
    await rebuildAndSave();
    toastService.success(`Папка «${name}» удалена`);
  } catch (err) {
    console.error('[local-settings] remove failed', err);
    toastService.error('Не удалось удалить папку');
  }
}

async function rebuildAndSave(): Promise<void> {
  // Просто очищаем кэш и перезагружаем через load()
  // (полная пересборка через TrackMerger — при следующем load())
  await localPersistenceService.clear();

  // Trigger reload
  const writer = createLibraryWriter();
  writer.removeBySource(PLUGIN_ID);

  toastService.info('Библиотека будет пересобрана при следующем открытии');
}
