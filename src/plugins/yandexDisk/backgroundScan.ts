// src/plugins/yandexDisk/backgroundScan.ts

import type { PluginContext, PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { folderStatusService } from '@/services/folders/FolderStatusService';

export interface BackgroundScanOptions {
  pluginId: string;
  context: PluginContext;
  pendingFolders: PluginSnapshot['folders'];
  /** true, если плагин был отключён (проверяется на каждом шаге). */
  isCancelled: () => boolean;
  /**
   * Функция скана. Передаётся явно, чтобы не зависеть от `this`.
   * Обычно это замыкание, замкнутое на `plugin.scanFolder`.
   */
  scanFolder: (context: PluginContext, folderId: FolderId, options: { recursive: boolean }) => Promise<PluginSnapshot>;
}

/**
 * Фоновый рекурсивный скан для набора дочерних папок.
 * Идёт последовательно, чтобы не завалить API и дать UI предсказуемую
 * последовательность «scanning → scanned».
 */
export async function backgroundScanPending(options: BackgroundScanOptions): Promise<void> {
  const { pluginId, context, pendingFolders, isCancelled, scanFolder } = options;

  try {
    for (const folder of pendingFolders) {
      if (isCancelled()) return;
      if (!folderStatusService.needsScan(folder.id)) continue;

      try {
        await scanFolder(context, folder.id, { recursive: true });
      } catch (err) {
        console.warn(`[${pluginId}] background scan failed for folder "${folder.name}"`, err);
        // Продолжаем скан остальных папок — одна упавшая не должна ломать всё.
      }
    }
  } catch (err) {
    console.warn(`[${pluginId}] background scan aborted`, err);
  }
}
