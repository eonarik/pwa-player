// src/composables/useAutoActions.ts

import { watch, type Ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useUiSettingsStore } from '@/stores/uiSettings'
import { metadataService } from '@/services/metadata/MetadataService'
import { metadataWorkerService } from '@/services/metadata/MetadataWorkerService'
import { runAutoFetch } from '@/services/metadata/runAutoFetch'
import { downloadSpaceService } from '@/services/download/DownloadSpaceService'
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator'
import { pluginCanDownload, isStreamingPlugin } from '@/plugins/registry'
import { isLocalTrack } from '@/services/library/selectors'
import { guessMetadataFromFilename } from '@/utils/parseFilename'
import type { Track } from '@/types/track'

export function useAutoActions(currentTrack: Ref<Track | null>) {
  const library = useLibraryStore()
  const uiSettings = useUiSettingsStore()

  // Защита от рекурсии: watch(currentTrack) может сработать повторно
  // после updateTrackMetadata / updateTrackInQueue.
  const processedTracks = new Set<string>()

  watch(currentTrack, async (track) => {
    if (!track) return

    // Стриминг — не ищем и не качаем.
    if (isStreamingPlugin(track.pluginId)) return

    if (processedTracks.has(track.id)) return
    processedTracks.add(track.id)

    const libTrack = library.getTrack(track.id)
    if (!libTrack) return

    // 1. Парсинг локального файла (только если тегов нет).
    if (libTrack.handle && !libTrack.hasId3Tags && libTrack.metaSource !== 'manual') {
      try {
        const file = await libTrack.handle.getFile()
        const parsed = await metadataWorkerService.parse(file)

        if (parsed) {
          metadataService.applyFromFile(libTrack.id, parsed)
          return
        }

        const guessed = guessMetadataFromFilename(libTrack.filename ?? libTrack.title)
        useLibraryStore().updateTrackMetadata(libTrack.id, {
          title: guessed.title || libTrack.title,
          artist: guessed.artist || libTrack.artist,
          metaSource: 'filename',
          hasId3Tags: false,
        })
        usePlayerStore().updateTrackInQueue(libTrack.id)

        const updated = library.getTrack(libTrack.id)
        if (updated) void runAutoFetch(updated)
        return
      } catch (err) {
        console.error('[auto-actions] failed to parse local track metadata', err)
      }
    }

    // 2. Автопоиск.
    void runAutoFetch(libTrack)

    // 3. Автоскачивание.
    const isDownloading = downloadOrchestrator.isDownloading(libTrack.id)
    const isWaitingForDownload =
      uiSettings.autoDownloadTracks &&
      pluginCanDownload(libTrack.pluginId) &&
      !isLocalTrack(libTrack) &&
      !isDownloading

    if (
      isWaitingForDownload &&
      downloadSpaceService.hasSpace.value &&
      !downloadSpaceService.needsPermission.value
    ) {
      void downloadOrchestrator.downloadTrack(libTrack).catch((err) => {
        console.warn('[auto-actions] auto-download failed', err)
      })
    }
  })
}
