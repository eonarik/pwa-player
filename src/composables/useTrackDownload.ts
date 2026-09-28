// src/composables/useTrackDownload.ts

import { computed, type Ref } from 'vue'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { toastService } from '@/services/ui/ToastService'
import type { LibraryTrack } from '@/types/library'

export function useTrackDownload(track: Ref<LibraryTrack | null | undefined>) {
  const trackId = computed(() => track.value?.id ?? '')

  const isDownloading = computed(() => {
    void downloadOrchestrator.version.value
    return trackId.value ? downloadOrchestrator.isDownloading(trackId.value) : false
  })

  const progress = computed(() => {
    void downloadOrchestrator.version.value
    if (!trackId.value) return null
    return downloadOrchestrator.getProgress(trackId.value)
  })

  const progressRatio = computed<number | null>(() => {
    const p = progress.value
    if (!p || p.total <= 0) return null
    return Math.min(1, p.written / p.total)
  })

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
    const t = track.value
    if (!t) return

    try {
      const ok = await ensureSpace()
      if (!ok) return

      await downloadOrchestrator.downloadTrack(t)
    } catch (err) {
      console.error('[download] failed', err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось скачать трек')
    }
  }

  function cancel(): void {
    if (trackId.value) {
      downloadOrchestrator.cancel(trackId.value)
    }
  }

  async function remove(): Promise<void> {
    const t = track.value
    if (!t) return

    try {
      await downloadOrchestrator.removeDownloaded(t)
    } catch (err) {
      console.error('[download] failed to remove', err)
      toastService.error(err instanceof Error ? err.message : 'Не удалось удалить трек')
    }
  }

  return {
    isDownloading,
    progress,
    progressRatio,
    download,
    cancel,
    remove,
  }
}
