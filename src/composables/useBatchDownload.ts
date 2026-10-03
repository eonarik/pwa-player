// src/composables/useBatchDownload.ts

import { computed, type Ref } from 'vue'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { pluginCanDownload } from '@/plugins/registry'
import { toastService } from '@/services/ui/ToastService'
import type { LibraryTrack } from '@/types/library'

export function useBatchDownload(tracks: Ref<LibraryTrack[]>) {
  const isDownloading = computed(() => downloadOrchestrator.isBatchDownloading.value)
  const progress = computed(() => downloadOrchestrator.batchProgress.value)

  /** Только треки из плагинов, которые умеют скачивать */
  const downloadableTracks = computed(() =>
    tracks.value.filter((t) => pluginCanDownload(t.pluginId)),
  )

  /** Показывать ли кнопку вообще */
  const hasDownloadable = computed(() => downloadableTracks.value.length > 0)

  /** Сколько из downloadable ещё не скачано */
  const pendingCount = computed(
    () => downloadableTracks.value.filter((t) => !t.origin || t.origin === 'remote').length,
  )

  async function ensureSpace(): Promise<boolean> {
    if (downloadSpaceService.needsPermission.value) {
      const state = await downloadSpaceService.requestAccess()
      if (state !== 'granted') {
        toastService.error('Нет доступа к папке скачивания')
        return false
      }
      return true
    }

    if (downloadSpaceService.hasSpace.value) return true

    const handle = await downloadSpaceService.pickSpace()
    if (!handle) {
      toastService.info('Папка для скачивания не выбрана')
      return false
    }
    return true
  }

  async function download(): Promise<void> {
    if (downloadableTracks.value.length === 0) return

    try {
      const ok = await ensureSpace()
      if (!ok) return

      const result = await downloadOrchestrator.downloadMany(downloadableTracks.value)

      if (result.aborted) {
        toastService.info(`Отменено. Скачано: ${result.succeeded}, пропущено: ${result.skipped}`)
        return
      }

      if (result.failed > 0) {
        toastService.error(`Скачано: ${result.succeeded}, ошибок: ${result.failed}`)
      } else if (result.succeeded > 0) {
        toastService.success(`Скачано: ${result.succeeded}`)
      } else if (result.skipped > 0) {
        toastService.info(`Все ${result.skipped} треков уже скачаны`)
      }
    } catch (err) {
      console.error('[download] batch failed', err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось скачать')
    }
  }

  function cancel(): void {
    downloadOrchestrator.cancelBatch()
  }

  return {
    isDownloading,
    progress,
    hasDownloadable,
    pendingCount,
    download,
    cancel,
  }
}
