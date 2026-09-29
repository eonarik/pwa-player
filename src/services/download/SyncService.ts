// src/services/download/SyncService.ts

import { ref, shallowRef } from 'vue'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createPluginContext } from '@/plugins/context'
import { createLibraryWriter } from '@/stores/library'
import { downloadOrchestrator } from './DownloadOrchestrator'
import { downloadSpaceService } from './DownloadSpaceService'
import { getFileFromPath } from './getFileFromPath'
import type { SyncReport, SyncIssues, SelectedIssues } from './types'
import type { LibraryTrack } from '@/types/library'

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

  async syncAll(): Promise<SyncReport[]> {
    if (this.isSyncing.value) return []
    if (!downloadSpaceService.hasSpace.value) return []

    this.isSyncing.value = true
    const reports: SyncReport[] = []
    const allIssues: SyncIssues[] = []

    try {
      const writer = createLibraryWriter()

      for (const manifest of getPlugins()) {
        try {
          // Пропускаем отключённые плагины — нет папок в библиотеке
          const pluginFolders = writer.getFoldersBySource(manifest.id)
          if (pluginFolders.length === 0) continue

          const plugin = await loadPlugin(manifest.id)
          if (!plugin.canDownload || !plugin.scanDownloadDir) continue

          const targetDir = await downloadSpaceService.getPluginDir(manifest.id)
          const scanResult = await downloadOrchestrator.scan(manifest.id)
          if (!scanResult) continue

          for (const [trackId, relativePath] of scanResult.downloaded) {
            writer.updateTrackOrigin(trackId, 'downloaded')
            const file = await getFileFromPath(targetDir, relativePath)
            if (file) {
              writer.updateTrackSource(trackId, file)
            }
          }

          for (const trackId of scanResult.missing) {
            writer.updateTrackOrigin(trackId, 'remote')
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

    // 1. Группируем onlyLocal по плагинам
    const byPlugin = new Map<string, SelectedIssues['onlyLocal']>()
    for (const item of selected.onlyLocal) {
      const list = byPlugin.get(item.pluginId) ?? []
      list.push(item)
      byPlugin.set(item.pluginId, list)
    }

    // 2. Создаём only-local треки
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

    // 3. Помечаем missing как remote
    const missingByPlugin = new Map<string, string[]>()
    for (const item of selected.missing) {
      const list = missingByPlugin.get(item.pluginId) ?? []
      list.push(item.trackId)
      missingByPlugin.set(item.pluginId, list)
    }

    for (const [pluginId, trackIds] of missingByPlugin) {
      try {
        for (const trackId of trackIds) {
          writer.updateTrackOrigin(trackId, 'remote')
        }
        const plugin = await loadPlugin(pluginId)
        if (plugin.saveCache) {
          await plugin.saveCache(createPluginContext(pluginId))
        }
      } catch (err) {
        console.error(`[sync] failed to mark missing for "${pluginId}"`, err)
      }
    }

    // 4. Сбрасываем issues
    this.dismissIssues()
  }

  dismissIssues(): void {
    this.issues.value = []
    this.issueCount.value = 0
  }

  /**
   * Убрать issues конкретного плагина (при отключении источника).
   */
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
