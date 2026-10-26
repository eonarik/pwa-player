// src/services/download/DownloadOrchestrator.ts

import { ref, shallowRef } from 'vue'
import type { LibraryTrack } from '@/types/library'
import { loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { createLibraryWriter } from '@/stores/library'
import { downloadSpaceService } from './DownloadSpaceService'
import type { ScanResult } from '@/plugins/types'
import { DownloadError, type TrackDownloadState } from './types'
import { toastService } from '@/services/ui/ToastService'
import { metadataWorkerService } from '../metadata/MetadataWorkerService'
import { metadataService } from '../metadata/MetadataService'

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

  async downloadTrack(track: LibraryTrack): Promise<boolean> {
    if (this.isDownloading(track.id)) return false
    try {
      await this.downloadTrackInternal(track, null)
      return true
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.info(`[download] cancelled for "${track.title}"`)
      } else if (err instanceof DownloadError && (err.status === 404 || err.status === 410)) {
        console.warn(`[download] file is broken (404/410) for "${track.title}"`)
        toastService.error(`Файл "${track.title}" не найден на Диске (удалён или битый)`)
      } else if (err instanceof DownloadError && err.status >= 500) {
        console.error(`[download] server error for "${track.title}"`, err)
        toastService.error(`Сервер временно недоступен. Не удалось скачать "${track.title}"`)
      } else {
        console.error(`[download] failed for "${track.title}"`, err)
        toastService.error(`Ошибка скачивания "${track.title}"`)
      }
      return false
    }
  }

  private async downloadTrackInternal(
    track: LibraryTrack,
    externalSignal: AbortSignal | null,
  ): Promise<void> {
    const pluginId = pluginIdFromSource(track.pluginId)
    const plugin = await loadPlugin(pluginId)
    if (!plugin.canDownload || !plugin.downloadTrack) {
      throw new Error(`Plugin "${track.pluginId}" does not support download`)
    }

    const targetDir = await downloadSpaceService.getPluginDir(track.pluginId)
    const pluginContext = createPluginContext(pluginId)

    const abort = new AbortController()
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

    let attempt = 0
    const MAX_ATTEMPTS = 3

    try {
      while (attempt < MAX_ATTEMPTS) {
        try {
          const result = await plugin.downloadTrack(pluginContext, track, {
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

          const writer = createLibraryWriter()
          if (result.handle) {
            writer.updateTrackHandle(track.id, result.handle)
          }
          writer.updateTrackFileLocation(track.id, 'both')
          writer.updateTrackSource(track.id, '')

          // Парсим MP3 сразу после скачивания (в воркере)
          if (track.filename.toLowerCase().endsWith('.mp3') && result.handle) {
            try {
              const file = await result.handle.getFile()
              const parsed = await metadataWorkerService.parse(file)

              if (parsed && parsed.artist) {
                // Теги есть
                metadataService.applyFromFile(track.id, parsed)
              } else {
                // Тегов нет — оставляем как есть (автопоиск сработает при запуске)
                writer.updateTrackFileLocation(track.id, 'both')
              }
            } catch (err) {
              console.warn('[download] failed to parse tags after download', err)
            }
          }

          if (plugin.saveCache) {
            await plugin.saveCache(pluginContext)
          }
          return // Успех — выходим из цикла
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw err // Отмену не ретраим
          }

          // Проверяем, не битый ли файл (404 от бэкенда)
          const isBrokenFile =
            err instanceof DownloadError && (err.status === 404 || err.status === 410)

          if (isBrokenFile) {
            const writer = createLibraryWriter()
            writer.updateTrackFileLocation(track.id, 'nowhere') // Помечаем как битый
            throw err // Пробрасываем дальше, чтобы показать тост
          }

          attempt++
          console.warn(`[download] attempt ${attempt} failed for "${track.title}":`, err)

          if (attempt >= MAX_ATTEMPTS) {
            throw err // Попытки кончились
          }

          // Сброс прогресса перед новой попыткой
          const s = this.states.value.get(track.id)
          if (s) {
            s.written = 0
            s.total = 0
            this.version.value++
          }

          // Ждем 2 секунды перед повтором (если не отменено)
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 2000)
            abort.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                reject(new DOMException('Aborted', 'AbortError'))
              },
              { once: true },
            )
          })
        }
      }
    } finally {
      this.states.value.delete(track.id)
      this.version.value++
    }
  }

  cancel(trackId: string): void {
    const state = this.states.value.get(trackId)
    if (state) state.abort.abort()
  }

  async downloadMany(tracks: LibraryTrack[]): Promise<BatchResult> {
    if (this.isBatchDownloading.value) {
      return { succeeded: 0, failed: 0, skipped: 0, errors: [], aborted: false }
    }

    const toDownload = tracks.filter((t) => {
      const loc = t.fileLocation ?? 'remote-only'
      return loc === 'remote-only'
    })
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

  async removeDownloaded(track: LibraryTrack): Promise<boolean> {
    const pluginId = pluginIdFromSource(track.pluginId)
    const plugin = await loadPlugin(pluginId)
    if (!plugin.removeDownloaded) {
      console.warn(`[download] plugin "${track.pluginId}" does not support removeDownloaded`)
      return false
    }

    const targetDir = await downloadSpaceService.getPluginDir(track.pluginId)
    const pluginContext = createPluginContext(pluginId)

    try {
      await plugin.removeDownloaded(pluginContext, track, targetDir)

      if (plugin.saveCache) {
        await plugin.saveCache(pluginContext)
      }

      return true
    } catch (err) {
      console.error(`[download] failed to remove "${track.title}"`, err)
      return false
    }
  }

  async scan(pluginId: string): Promise<ScanResult | null> {
    const plugin = await loadPlugin(pluginIdFromSource(pluginId))
    if (!plugin.scanDownloadDir) return null

    const targetDir = await downloadSpaceService.getPluginDir(pluginId)
    const pluginContext = createPluginContext(pluginIdFromSource(pluginId))

    try {
      return await plugin.scanDownloadDir(pluginContext, targetDir)
    } catch (err) {
      console.error(`[download] scan failed for "${pluginId}"`, err)
      return null
    }
  }
}

export const downloadOrchestrator = DownloadOrchestrator.getInstance()
