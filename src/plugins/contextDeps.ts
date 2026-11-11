// src/plugins/contextDeps.ts

import type { LibraryWriter } from '@/services/library/LibraryWriter';

/**
 * Зависимости ядра, инъектируемые в PluginContext.
 *
 * Позволяет context.ts не импортировать stores/library и DownloadSpaceService
 * напрямую — что разрывает рантайм-цикл.
 *
 * Инициализируется один раз в main.ts (composition root) до bootstrap.
 */
export interface PluginContextDeps {
  /** Фабрика writer'а. Вызывается при каждом createPluginContext. */
  createWriter(): LibraryWriter;

  /** Получить папку скачиваний плагина (или null, если не выбрана). */
  getDownloadDir: (pluginId: string) => Promise<FileSystemDirectoryHandle | null>;
}

let deps: PluginContextDeps | null = null;

export function setPluginContextDeps(value: PluginContextDeps): void {
  deps = value;
}

export function getPluginContextDeps(): PluginContextDeps {
  if (!deps) {
    throw new Error(
      '[contextDeps] не инициализирован. Вызовите setPluginContextDeps() из composition root (main.ts) до первого createPluginContext().',
    );
  }
  return deps;
}
