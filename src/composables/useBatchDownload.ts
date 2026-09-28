// src/composables/useBatchDownload.ts

import { computed, type Ref } from 'vue'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { toastService } from '@/services/ui/ToastService'
import type { LibraryTrack } from '@/types/library'

export function useBatchDownload(tracks: Ref<LibraryTrack[]>) {
  const isDownloading = computed(() => downloadOrchestrator.isBatchDownloading.value)
  const progress = computed(() => downloadOrchestrator.batchProgress.value)

  /** Сколько из переданных треков ещё не скачано */
  const pendingCount = computed(
    () => tracks.value.filter((t) => !t.origin || t.origin === 'remote').length,
  )

  /** Убедиться, что спейс выбран. Если нет — запросить. */
  async function ensureSpace(): Promise<boolean> {
    if (downloadSpaceService.hasSpace.value) return true
    const handle = await downloadSpaceService.pickSpace()
    if (!handle) {
      toastService.info('Папка для скачивания не выбрана')
      return false
    }
    return true
  }

  async function download(): Promise<void> {
    if (tracks.value.length === 0) return

    try {
      const ok = await ensureSpace()
      if (!ok) return

      const result = await downloadOrchestrator.downloadMany(tracks.value)

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
    pendingCount,
    download,
    cancel,
  }
}
