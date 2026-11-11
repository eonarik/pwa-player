// src/services/download/batch.ts

import { ref, shallowRef, type Ref } from 'vue';
import type { Track } from '@/types/track';

export interface BatchResult {
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ track: Track; message: string }>;
  aborted: boolean;
}

export interface BatchProgress {
  done: number;
  total: number;
  currentName: string;
}

/** Загрузка одного трека в составе батча. Бросает AbortError при отмене. */
export type DownloadOne = (track: Track, signal: AbortSignal) => Promise<void>;

/**
 * Треки, подлежащие скачиванию: есть cloud-источник и ещё нет локального.
 * Уже скачанные и «не скачиваемые» (например, только streaming) — пропускаем.
 */
export function selectDownloadable(tracks: Track[]): Track[] {
  return tracks.filter((track) => {
    const hasLocal = track.sources.some((s) => s.kind === 'local');
    return !hasLocal && track.sources.some((s) => s.kind === 'cloud');
  });
}

function emptyResult(skipped = 0): BatchResult {
  return { succeeded: 0, failed: 0, skipped, errors: [], aborted: false };
}

export interface BatchRunner {
  readonly isBatchDownloading: Ref<boolean>;
  readonly batchProgress: Ref<BatchProgress | null>;
  downloadMany(tracks: Track[]): Promise<BatchResult>;
  cancelBatch(): void;
}

/**
 * Последовательная пакетная загрузка. Параллельная не делается намеренно:
 * качаем по одному, чтобы не создавать нагрузку на диск и облако.
 */
export function createBatchRunner(downloadOne: DownloadOne): BatchRunner {
  const isBatchDownloading = ref(false);
  const batchProgress = shallowRef<BatchProgress | null>(null);
  let batchAbort: AbortController | null = null;

  function cancelBatch(): void {
    batchAbort?.abort();
  }

  async function downloadMany(tracks: Track[]): Promise<BatchResult> {
    // Повторный запуск игнорируется: идёт только один батч за раз.
    if (isBatchDownloading.value) return emptyResult();

    const toDownload = selectDownloadable(tracks);
    const skipped = tracks.length - toDownload.length;
    if (toDownload.length === 0) return emptyResult(skipped);

    isBatchDownloading.value = true;
    batchProgress.value = { done: 0, total: toDownload.length, currentName: '' };
    batchAbort = new AbortController();

    const errors: BatchResult['errors'] = [];
    let succeeded = 0;
    let aborted = false;

    const report = (currentName: string): void => {
      batchProgress.value = { done: succeeded + errors.length, total: toDownload.length, currentName };
    };

    try {
      for (const track of toDownload) {
        if (batchAbort.signal.aborted) {
          aborted = true;
          break;
        }

        report(track.title);

        try {
          await downloadOne(track, batchAbort.signal);
          succeeded++;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            aborted = true;
            break;
          }
          errors.push({ track, message: err instanceof Error ? err.message : String(err) });
        }

        report(track.title);
      }
    } finally {
      isBatchDownloading.value = false;
      batchProgress.value = null;
      batchAbort = null;
    }

    return { succeeded, failed: errors.length, skipped, errors, aborted };
  }

  return { isBatchDownloading, batchProgress, downloadMany, cancelBatch };
}
