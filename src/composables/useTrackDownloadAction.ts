// src/composables/useTrackDownloadAction.ts

import { computed, type ComputedRef, type Ref } from 'vue';
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { DownloadError } from '@/services/download/types';
import { hasLocalSource } from '@/services/library/selectors';
import { toastService } from '@/services/ui/ToastService';
import type { Track } from '@/types/track';
import { logger } from '@/utils/logger';

/**
 * Пункт меню «Скачать / Отменить / Удалить с устройства»: один переключатель
 * состояний вместо трёх разрозненных веток в компоненте.
 */
export function useTrackDownloadAction(track: Ref<Track>, libraryTrack: ComputedRef<Track | null>) {
  const isDownloading = computed(() => downloadOrchestrator.isDownloading(track.value.id));

  /** Процент загрузки или null, если знаменателя нет / загрузка не идёт. */
  const downloadProgress = computed<number | null>(() => {
    if (!isDownloading.value) return null;
    const p = downloadOrchestrator.getProgress(track.value.id);
    if (!p || p.total <= 0) return null;
    return Math.round((p.written / p.total) * 100);
  });

  /** Файл уже лежит на устройстве. */
  const isDownloaded = computed(() => {
    const t = libraryTrack.value;
    return t ? hasLocalSource(t) : false;
  });

  const downloadLabel = computed(() => {
    if (isDownloading.value) {
      return downloadProgress.value !== null
        ? `Скачивание… ${downloadProgress.value}% · Отменить`
        : 'Отменить скачивание';
    }
    const t = libraryTrack.value;
    if (!t) return 'Скачать';
    return isDownloaded.value ? 'Удалить с устройства' : 'Скачать';
  });

  async function onDownload(close: () => void): Promise<void> {
    close();
    const t = libraryTrack.value;
    if (!t) return;

    if (isDownloading.value) {
      downloadOrchestrator.cancel(t.id);
      return;
    }

    if (isDownloaded.value) {
      try {
        await downloadOrchestrator.removeDownloaded(t);
        toastService.success('Файл удалён с устройства');
      } catch (err) {
        logger.error('[track-actions] remove failed', err);
        toastService.error(err instanceof Error ? err.message : 'Не удалось удалить');
      }
      return;
    }

    try {
      if (!downloadSpaceService.hasSpace.value) {
        const ok = await downloadSpaceService.pickSpace();
        if (!ok) return;
      }
      const success = await downloadOrchestrator.downloadTrack(t);
      if (success) {
        toastService.success('Скачивание завершено');
      } else {
        toastService.error('Не удалось скачать трек');
      }
    } catch (err) {
      logger.error('[track-actions] download failed', err);
      if (err instanceof DownloadError && (err.status === 404 || err.status === 410)) {
        toastService.error(`Файл "${t.title}" не найден на Диске`);
      } else if (err instanceof Error) {
        toastService.error(err.message);
      } else {
        toastService.error('Не удалось скачать');
      }
    }
  }

  return { isDownloading, downloadProgress, isDownloaded, downloadLabel, onDownload };
}
