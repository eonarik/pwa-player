// src/plugins/yandexDisk/textFiles.ts

import type { PluginContext, TextFileRef } from '../types';
import type { FolderId } from '@/types/ids';
import type { IYandexService } from './types';
import type { PluginStorage } from './storage';

export function createTextFileMethods(pluginId: string, service: IYandexService, storage: PluginStorage) {
  async function getTextFiles(context: PluginContext, folderId: FolderId): Promise<TextFileRef[]> {
    const pathMap = storage.getPathMap();
    const remotePath = pathMap[folderId];
    if (!remotePath) return [];

    try {
      const response = await service.listResources(remotePath);
      const items = response._embedded?.items || response.items || [];
      return items
        .filter((item) => item.type === 'file' && item.name.toLowerCase().endsWith('.txt'))
        .map((item) => ({
          name: item.name,
          remotePath: item.path,
          path: item.name,
        }));
    } catch (err) {
      console.error(`[${pluginId}] getTextFiles failed`, err);
      return [];
    }
  }

  async function readTextFile(context: PluginContext, remotePath: string) {
    try {
      const result = await service.readTextFile(remotePath);
      return result ? { content: result.content, modified: result.modified } : null;
    } catch (err) {
      console.error(`[${pluginId}] readTextFile failed`, err);
      return null;
    }
  }

  async function writeTextFile(context: PluginContext, remotePath: string, content: string) {
    const result = await service.writeTextFile(remotePath, content);
    return { modified: result.modified };
  }

  async function buildFileUrl(context: PluginContext, remotePath: string): Promise<string | null> {
    try {
      return service.buildDownloadUrl(remotePath);
    } catch {
      return null;
    }
  }

  return { getTextFiles, readTextFile, writeTextFile, buildFileUrl };
}
