// src/services/download/DownloadOrchestrator.ts

import { ref, shallowRef } from 'vue'
import type { LibraryTrack } from '@/types/library'
import { loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { createLibraryWriter } from '@/stores/library'
import { downloadSpaceService } from './DownloadSpaceService'
import type { ScanResult } from '@/plugins/types'
import type { TrackDownloadState } from './types'

export interface BatchResult {
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{ track: LibraryTrack; message: string }>
  aborted: boolean
}

export interface BatchProgress {
  done: number
  total: number
  currentName: string
}

class DownloadOrchestrator {
  private static instance: DownloadOrchestrator | null = null

  private states = shallowRef<Map<string, TrackDownloadState>>(new Map())
  readonly version = ref(0)

  readonly isBatchDownloading = ref(false)
  readonly batchProgress = shallowRef<BatchProgress | null>(null)
  private batchAbort: AbortController | null = null

  static getInstance(): DownloadOrchestrator {
    if (!DownloadOrchestrator.instance) {
      DownloadOrchestrator.instance = new DownloadOrchestrator()
    }
    return DownloadOrchestrator.instance
  }

  // --- Состояние одного трека ----------------------------------------

  isDownloading(trackId: string): boolean {
    void this.version.value
    return this.states.value.has(trackId)
  }

  getProgress(trackId: string): { written: number; total: number } | null {
    void this.version.value
    const state = this.states.value.get(trackId)
    if (!state) return null
    return { written: state.written, total: state.total }
  }

  // --- Скачивание одного трека ---------------------------------------

  async downloadTrack(track: LibraryTrack): Promise<boolean> {
    if (this.isDownloading(track.id)) return false

    try {
      await this.downloadTrackInternal(track, null)
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.info(`[download] cancelled for "${track.title}"`)
      } else {
        console.error(`[download] failed for "${track.title}"`, err)
      }
      return false
    }
  }

  /**
   * Внутренний метод: скачивает один трек.
   * Использует либо свой AbortController, либо внешний (для batch).
   */
  private async downloadTrackInternal(
    track: LibraryTrack,
    externalSignal: AbortSignal | null,
  ): Promise<void> {
    const plugin = await loadPlugin(track.pluginId)
    if (!plugin.canDownload || !plugin.downloadTrack) {
      throw new Error(`Plugin "${track.pluginId}" does not support download`)
    }

    const targetDir = await downloadSpaceService.getPluginDir(track.pluginId)
    const pluginContext = createPluginContext(track.pluginId)

    const abort = new AbortController()
    // Если есть внешний signal — связываем
    if (externalSignal) {
      if (externalSignal.aborted) throw new DOMException('Aborted', 'AbortError')
      externalSignal.addEventListener('abort', () => abort.abort(), { once: true })
    }

    const state: TrackDownloadState = {
      trackId: track.id,
      written: 0,
      total: 0,
      abort,
    }
    this.states.value.set(track.id, state)
    this.version.value++

    try {
      await plugin.downloadTrack(pluginContext, track, {
        targetDir,
        signal: abort.signal,
        onProgress: (written, total) => {
          const s = this.states.value.get(track.id)
          if (s) {
            s.written = written
            s.total = total
            this.version.value++
          }
        },
      })

      // Обновляем origin
      const writer = createLibraryWriter()
      writer.updateTrackOrigin(track.id, 'downloaded')

      // Сохраняем в IDB плагина
      if (plugin.saveCache) {
        await plugin.saveCache(pluginContext)
      }
    } finally {
      this.states.value.delete(track.id)
      this.version.value++
    }
  }

  cancel(trackId: string): void {
    const state = this.states.value.get(trackId)
    if (state) {
      state.abort.abort()
    }
  }

  // --- Пакетное скачивание -------------------------------------------

  async downloadMany(tracks: LibraryTrack[]): Promise<BatchResult> {
    if (this.isBatchDownloading.value) {
      return { succeeded: 0, failed: 0, skipped: 0, errors: [], aborted: false }
    }

    const toDownload = tracks.filter((t) => !t.origin || t.origin === 'remote')
    const skipped = tracks.length - toDownload.length

    if (toDownload.length === 0) {
      return { succeeded: 0, failed: 0, skipped, errors: [], aborted: false }
    }

    this.isBatchDownloading.value = true
    this.batchProgress.value = { done: 0, total: toDownload.length, currentName: '' }
    this.batchAbort = new AbortController()

    const errors: Array<{ track: LibraryTrack; message: string }> = []
    let succeeded = 0
    let aborted = false

    try {
      for (const track of toDownload) {
        if (this.batchAbort.signal.aborted) {
          aborted = true
          break
        }

        this.batchProgress.value = {
          done: succeeded + errors.length,
          total: toDownload.length,
          currentName: track.title,
        }

        try {
          await this.downloadTrackInternal(track, this.batchAbort.signal)
          succeeded++
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            aborted = true
            break
          }
          errors.push({
            track,
            message: err instanceof Error ? err.message : String(err),
          })
        }

        this.batchProgress.value = {
          done: succeeded + errors.length,
          total: toDownload.length,
          currentName: track.title,
        }
      }
    } finally {
      this.isBatchDownloading.value = false
      this.batchProgress.value = null
      this.batchAbort = null
    }

    return { succeeded, failed: errors.length, skipped, errors, aborted }
  }

  cancelBatch(): void {
    this.batchAbort?.abort()
  }

  // --- Удаление ------------------------------------------------------

  async removeDownloaded(track: LibraryTrack): Promise<boolean> {
    const plugin = await loadPlugin(track.pluginId)
    if (!plugin.removeDownloaded) {
      console.warn(`[download] plugin "${track.pluginId}" does not support removeDownloaded`)
      return false
    }

    const targetDir = await downloadSpaceService.getPluginDir(track.pluginId)
    const pluginContext = createPluginContext(track.pluginId)

    try {
      await plugin.removeDownloaded(pluginContext, track, targetDir)

      const writer = createLibraryWriter()
      if (track.origin === 'downloaded') {
        writer.updateTrackOrigin(track.id, 'remote')
      } else if (track.origin === 'only-local') {
        writer.removeTracks([track.id])
      }

      if (plugin.saveCache) {
        await plugin.saveCache(pluginContext)
      }

      return true
    } catch (err) {
      console.error(`[download] failed to remove "${track.title}"`, err)
      return false
    }
  }

  // --- Сканирование --------------------------------------------------

  async scan(pluginId: string): Promise<ScanResult | null> {
    const plugin = await loadPlugin(pluginId)
    if (!plugin.scanDownloadDir) return null

    const targetDir = await downloadSpaceService.getPluginDir(pluginId)
    const pluginContext = createPluginContext(pluginId)

    try {
      return await plugin.scanDownloadDir(pluginContext, targetDir)
    } catch (err) {
      console.error(`[download] scan failed for "${pluginId}"`, err)
      return null
    }
  }
}

export const downloadOrchestrator = DownloadOrchestrator.getInstance()
