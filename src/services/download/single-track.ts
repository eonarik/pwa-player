// src/services/download/single-track.ts

import type { CloudTrackSource, Track, TrackSource } from '@/types/track';
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { createLibraryWriter } from '@/stores/library';
import { downloadSpaceService } from './DownloadSpaceService';
import { DownloadError } from './types';
import { metadataWorkerService } from '../metadata/MetadataWorkerService';
import { metadataService } from '../metadata/MetadataService';
import { newTrackSourceId } from '@/types/ids';
import { logger } from '@/utils/logger';
import type { ActiveDownloads } from './active-downloads';

export const MAX_DOWNLOAD_ATTEMPTS = 3;

export interface SingleTrackOptions {
  active: ActiveDownloads;
  /** Задержка перед повтором (мс). В продакшене 2000, в тестах 0. */
  retryDelayMs: number;
}

export async function downloadTrackInternal(
  track: Track,
  externalSignal: AbortSignal | null,
  options: SingleTrackOptions,
): Promise<void> {
  const cloudSource = track.sources.find((s) => s.kind === 'cloud');
  if (!cloudSource) {
    throw new Error(`Track "${track.id}" has no cloud source to download`);
  }

  const pluginId = pluginIdFromSource(cloudSource.pluginId);
  const plugin = await loadPlugin(pluginId);
  if (!plugin.canDownload || !plugin.downloadTrack) {
    throw new Error(`Plugin "${pluginId}" does not support download`);
  }

  const targetDir = await downloadSpaceService.getPluginDir(pluginId);
  const pluginContext = createPluginContext(pluginId);

  const abort = new AbortController();
  if (externalSignal) {
    if (externalSignal.aborted) throw new DOMException('Aborted', 'AbortError');
    externalSignal.addEventListener('abort', () => abort.abort(), { once: true });
  }

  options.active.begin(track.id, abort);

  let attempt = 0;
  const { active, retryDelayMs } = options;

  try {
    while (attempt < MAX_DOWNLOAD_ATTEMPTS) {
      try {
        const result = await plugin.downloadTrack(pluginContext, track, cloudSource, {
          targetDir,
          signal: abort.signal,
          onProgress: (written: number, total: number) => {
            active.reportProgress(track.id, written, total);
          },
        });

        attachLocalSource(track, pluginId, cloudSource, result.handle);

        if (track.sources[0]?.kind !== 'local') {
          try {
            const file = await result.handle.getFile();
            const parsed = await metadataWorkerService.parse(file);
            if (parsed && parsed.metadata.artist) {
              metadataService.applyFromFile(track.id, parsed.metadata, parsed.coverBlob);
            }
          } catch (err) {
            logger.warn('[download] failed to parse tags after download', err);
          }
        }

        if (plugin.saveCache) {
          await plugin.saveCache(pluginContext);
        }
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw err;
        }

        const isBrokenFile = err instanceof DownloadError && (err.status === 404 || err.status === 410);
        if (isBrokenFile) {
          throw err;
        }

        attempt++;
        logger.warn(`[download] attempt ${attempt} failed for "${track.title}":`, err);

        if (attempt >= MAX_DOWNLOAD_ATTEMPTS) {
          throw err;
        }

        active.resetProgress(track.id);

        await retryDelay(retryDelayMs, abort.signal);
      }
    }
  } finally {
    active.finish(track.id);
  }
}

/**
 * Скачанный файл становится локальным источником трека: он добавляется с
 * приоритетом 10 (ниже cloud/streaming-источников нет — локальный выигрывает),
 * остальные источники сохраняются, порядок пересобирается по priority.
 */
function attachLocalSource(
  track: Track,
  pluginId: string,
  cloudSource: CloudTrackSource,
  handle: FileSystemFileHandle,
): void {
  const localSource: TrackSource = {
    id: newTrackSourceId(),
    pluginId,
    priority: 10,
    kind: 'local',
    handle,
    folderId: cloudSource.folderId,
  };

  const nextSources = [localSource, ...track.sources.filter((s) => s.kind !== 'local')].sort(
    (a, b) => a.priority - b.priority,
  );

  createLibraryWriter().updateTrackSources(track.id, nextSources);
}

function retryDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
