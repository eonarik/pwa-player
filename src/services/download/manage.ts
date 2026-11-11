// src/services/download/manage.ts

import type { Track } from '@/types/track';
import type { ScanResult } from '@/plugins/types';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { createLibraryWriter } from '@/stores/library';
import { downloadSpaceService } from './DownloadSpaceService';
import { logger } from '@/utils/logger';

/**
 * Удаляет скачанный файл и снимает локальный источник с трека.
 *
 * @returns false, если локального источника нет (нечего удалять).
 */
export async function removeDownloaded(track: Track): Promise<boolean> {
  const localSource = track.sources.find((s) => s.kind === 'local');
  if (!localSource) return false;

  const pluginId = pluginIdFromSource(localSource.pluginId);
  const plugin = await loadPlugin(pluginId);
  if (!plugin.removeDownloaded) {
    throw new Error(`Plugin "${pluginId}" does not support removing downloads`);
  }

  const targetDir = await downloadSpaceService.getPluginDir(pluginId);
  const pluginContext = createPluginContext(pluginId);

  await plugin.removeDownloaded(pluginContext, track, localSource, targetDir);

  const nextSources = track.sources.filter((s) => s.kind !== 'local');
  createLibraryWriter().updateTrackSources(track.id, nextSources);

  if (plugin.saveCache) {
    await plugin.saveCache(pluginContext);
  }

  return true;
}

/**
 * Сверяет папку загрузок плагина с его облаком (для отчёта о рассинхроне).
 * null — плагин не умеет сканировать или скан не удался.
 */
export async function scanDownloads(pluginId: string): Promise<ScanResult | null> {
  const plugin = await loadPlugin(pluginIdFromSource(pluginId));
  if (!plugin.scanDownloadDir) return null;

  const targetDir = await downloadSpaceService.getPluginDir(pluginId);
  const pluginContext = createPluginContext(pluginIdFromSource(pluginId));

  try {
    return await plugin.scanDownloadDir(pluginContext, targetDir);
  } catch (err) {
    logger.error(`[download] scan failed for "${pluginId}"`, err);
    return null;
  }
}
