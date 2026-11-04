// src/plugins/yandexDisk/backgroundScan.ts

import type { PluginContext, PluginSnapshot } from '../types';
import type { FolderId } from '@/types/ids';
import { needsScan } from '@/utils/folderStatus';

export interface BackgroundScanOptions {
  pluginId: string;
  context: PluginContext;
  pendingFolders: PluginSnapshot['folders'];
  isCancelled: () => boolean;
  scanFolder: (context: PluginContext, folderId: FolderId, options: { recursive: boolean }) => Promise<PluginSnapshot>;
}

export async function backgroundScanPending(options: BackgroundScanOptions): Promise<void> {
  const { pluginId, context, pendingFolders, isCancelled, scanFolder } = options;

  try {
    for (const folder of pendingFolders) {
      if (isCancelled()) return;

      const liveFolder = context.writer.getFolder(folder.id);
      if (!liveFolder || !needsScan(liveFolder)) continue;

      try {
        await scanFolder(context, folder.id, { recursive: true });
      } catch (err) {
        console.warn(`[${pluginId}] background scan failed for folder "${folder.name}"`, err);
      }
    }
  } catch (err) {
    console.warn(`[${pluginId}] background scan aborted`, err);
  }
}
