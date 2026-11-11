// src/services/download/DownloadOrchestrator.ts

import type { Track } from '@/types/track';
import type { ScanResult } from '@/plugins/types';
import type { TrackId } from '@/types/ids';
import { logger } from '@/utils/logger';
import { createActiveDownloads, type ActiveDownloads, type DownloadProgress } from './active-downloads';
import { downloadTrackInternal } from './single-track';
import { createBatchRunner, type BatchProgress, type BatchResult } from './batch';
import { removeDownloaded, scanDownloads } from './manage';

export type { BatchProgress, BatchResult, DownloadProgress };

/** Пауза перед повторной попыткой скачать трек. */
const RETRY_DELAY_MS = 2000;

/**
 * Оркестратор скачивания треков из облака в локальное хранилище.
 *
 * Фасад над модулями:
 * - `active-downloads` — учёт текущих загрузок и их прогресс (реактивный);
 * - `single-track` — скачивание одного трека с повторами;
 * - `batch` — последовательный пакетный режим;
 * - `manage` — удаление скачанного и сверка папки загрузок.
 */
class DownloadOrchestrator {
  private static instance: DownloadOrchestrator | null = null;

  private active: ActiveDownloads = createActiveDownloads();
  private batch = createBatchRunner((track, signal) =>
    downloadTrackInternal(track, signal, { active: this.active, retryDelayMs: RETRY_DELAY_MS }),
  );

  /** Пин для подписки на прогресс: см. `active-downloads`. */
  readonly version = this.active.version;
  readonly isBatchDownloading = this.batch.isBatchDownloading;
  readonly batchProgress = this.batch.batchProgress;

  static getInstance(): DownloadOrchestrator {
    if (!DownloadOrchestrator.instance) {
      DownloadOrchestrator.instance = new DownloadOrchestrator();
    }
    return DownloadOrchestrator.instance;
  }

  isDownloading(trackId: TrackId): boolean {
    return this.active.has(trackId);
  }

  getProgress(trackId: TrackId): DownloadProgress | null {
    return this.active.progressOf(trackId);
  }

  cancel(trackId: TrackId): void {
    this.active.abortControllerOf(trackId)?.abort();
  }

  /** Одиночное скачивание: false, если трек уже качается или что-то пошло не так. */
  async downloadTrack(track: Track): Promise<boolean> {
    if (this.isDownloading(track.id)) return false;
    try {
      await downloadTrackInternal(track, null, { active: this.active, retryDelayMs: RETRY_DELAY_MS });
      return true;
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        logger.error(`[download] failed for "${track.title}"`, err);
      }
      return false;
    }
  }

  downloadMany(tracks: Track[]): Promise<BatchResult> {
    return this.batch.downloadMany(tracks);
  }

  cancelBatch(): void {
    this.batch.cancelBatch();
  }

  removeDownloaded(track: Track): Promise<boolean> {
    return removeDownloaded(track);
  }

  scan(pluginId: string): Promise<ScanResult | null> {
    return scanDownloads(pluginId);
  }
}

export const downloadOrchestrator = DownloadOrchestrator.getInstance();
