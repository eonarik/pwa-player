// src/services/download/SyncService.ts

import { ref, shallowRef } from 'vue'
import { getPlugins, loadPlugin, pluginIdFromSource } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { createLibraryWriter } from '@/stores/library'
import { downloadOrchestrator } from './DownloadOrchestrator'
import { downloadSpaceService } from './DownloadSpaceService'
import { getFileHandleFromPath } from './getFileFromPath'
import { toastService } from '@/services/ui/ToastService'
import type { SyncReport, SyncIssues, SelectedIssues } from './types'
import type { LibraryTrack } from '@/types'

class SyncService {
  private static instance: SyncService | null = null

  readonly isSyncing = ref(false)
  readonly issues = shallowRef<SyncIssues[]>([])
  readonly issueCount = ref(0)

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  // --- сканирование одного плагина -------------------------
  async scanPlugin(pluginId: string): Promise<void> {
    if (!downloadSpaceService.hasSpace.value) return

    try {
      const plugin = await loadPlugin(pluginIdFromSource(pluginId))
      if (!plugin.scanDownloadDir || !plugin.canDownload) return

      const targetDir = await downloadSpaceService.getPluginDir(pluginId)
      const scanResult = await downloadOrchestrator.scan(pluginId)
      if (!scanResult) return

      const writer = createLibraryWriter()

      // Обновляем скачанные треки
      for (const [trackId, relativePath] of scanResult.downloaded) {
        const handle = await getFileHandleFromPath(targetDir, relativePath)
        if (handle) {
          writer.updateTrackHandle(trackId, handle)
          writer.updateTrackFileLocation(trackId, 'both')
          writer.updateTrackSource(trackId, '')
        }
      }

      // Обновляем отсутствующие треки
      for (const trackId of scanResult.missing) {
        writer.updateTrackFileLocation(trackId, 'remote-only')
        writer.updateTrackHandle(trackId, undefined)
      }

      // Сохраняем кеш плагина
      if (plugin.saveCache) {
        const context = createPluginContext(pluginIdFromSource(pluginId))
        await plugin.saveCache(context)
      }
    } catch (err) {
      console.warn(`[sync] failed to scan plugin "${pluginId}"`, err)
    }
  }

  // --- полная синхронизация ------------------------

  async syncAll(): Promise<SyncReport[]> {
    if (this.isSyncing.value) return []

    if (!downloadSpaceService.hasSpace.value) {
      toastService.info('Папка скачивания не выбрана — синхронизировать нечего')
      return []
    }

    this.isSyncing.value = true
    const reports: SyncReport[] = []
    const allIssues: SyncIssues[] = []

    try {
      const writer = createLibraryWriter()
      let skippedWithoutFolders = 0

      for (const manifest of getPlugins()) {
        try {
          const pluginFolders = writer.getFoldersBySource(manifest.id)
          if (pluginFolders.length === 0) {
            skippedWithoutFolders++
            continue
          }

          const plugin = await loadPlugin(pluginIdFromSource(manifest.id))
          if (!plugin.canDownload || !plugin.scanDownloadDir) continue

          const targetDir = await downloadSpaceService.getPluginDir(manifest.id)
          const scanResult = await downloadOrchestrator.scan(manifest.id)
          if (!scanResult) continue

          for (const [trackId, relativePath] of scanResult.downloaded) {
            const handle = await getFileHandleFromPath(targetDir, relativePath)
            if (handle) {
              writer.updateTrackHandle(trackId, handle)
              writer.updateTrackFileLocation(trackId, 'both')
              writer.updateTrackSource(trackId, '')
            }
          }

          for (const trackId of scanResult.missing) {
            writer.updateTrackFileLocation(trackId, 'remote-only')
            writer.updateTrackHandle(trackId, undefined)
          }

          const issues: SyncIssues = {
            pluginId: manifest.id,
            onlyLocal: scanResult.onlyLocal,
            missing: scanResult.missing,
          }

          const hasIssues = scanResult.onlyLocal.length > 0 || scanResult.missing.length > 0

          const report: SyncReport = {
            pluginId: manifest.id,
            downloaded: scanResult.downloaded.size,
            onlyLocalCount: scanResult.onlyLocal.length,
            missingCount: scanResult.missing.length,
            issues: hasIssues ? issues : null,
          }

          reports.push(report)
          if (hasIssues) allIssues.push(issues)

          if (plugin.saveCache) {
            await plugin.saveCache(createPluginContext(manifest.id))
          }
        } catch (err) {
          console.warn(`[sync] failed for plugin "${manifest.id}"`, err)
        }
      }

      if (reports.length === 0) {
        if (skippedWithoutFolders > 0) {
          toastService.info('Нет подключённых источников с папками. Откройте источник и повторите.')
        } else {
          toastService.info('Нечего синхронизировать')
        }
      }

      this.issues.value = allIssues
      this.issueCount.value = allIssues.reduce(
        (sum, i) => sum + i.onlyLocal.length + i.missing.length,
        0,
      )

      return reports
    } finally {
      this.isSyncing.value = false
    }
  }

  async resolveIssues(selected: SelectedIssues): Promise<void> {
    const writer = createLibraryWriter()

    const byPlugin = new Map<string, SelectedIssues['onlyLocal']>()
    for (const item of selected.onlyLocal) {
      const list = byPlugin.get(item.pluginId) ?? []
      list.push(item)
      byPlugin.set(item.pluginId, list)
    }

    for (const [pluginId, items] of byPlugin) {
      try {
        const plugin = await loadPlugin(pluginId)
        if (!plugin.createLocalTrack) continue

        const context = createPluginContext(pluginId)
        const newTracks: LibraryTrack[] = []

        for (const item of items) {
          const track = await plugin.createLocalTrack(context, item.relativePath, item.filename)
          if (track) newTracks.push(track)
        }

        if (newTracks.length > 0) {
          writer.addTracks(newTracks, pluginId)
          if (plugin.saveCache) {
            await plugin.saveCache(context)
          }
        }
      } catch (err) {
        console.error(`[sync] failed to create local tracks for "${pluginId}"`, err)
      }
    }

    const missingByPlugin = new Map<string, string[]>()
    for (const item of selected.missing) {
      const list = missingByPlugin.get(item.pluginId) ?? []
      list.push(item.trackId)
      missingByPlugin.set(item.pluginId, list)
    }

    for (const [pluginId, trackIds] of missingByPlugin) {
      try {
        for (const trackId of trackIds) {
          writer.updateTrackFileLocation(trackId, 'remote-only')
          writer.updateTrackHandle(trackId, undefined)
        }
        const plugin = await loadPlugin(pluginId)
        if (plugin.saveCache) {
          await plugin.saveCache(createPluginContext(pluginId))
        }
      } catch (err) {
        console.error(`[sync] failed to mark missing for "${pluginId}"`, err)
      }
    }

    this.dismissIssues()
  }

  dismissIssues(): void {
    this.issues.value = []
    this.issueCount.value = 0
  }

  clearIssuesForPlugin(pluginId: string): void {
    const remaining = this.issues.value.filter((i) => i.pluginId !== pluginId)
    this.issues.value = remaining
    this.issueCount.value = remaining.reduce(
      (sum, i) => sum + i.onlyLocal.length + i.missing.length,
      0,
    )
  }
}

export const syncService = SyncService.getInstance()
