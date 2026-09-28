// src/services/download/SyncService.ts

import { ref, shallowRef } from 'vue'
import { getPlugins, loadPlugin } from '@/plugins/registry'
import { createLibraryWriter } from '@/stores/library'
import { downloadOrchestrator } from './DownloadOrchestrator'
import { downloadSpaceService } from './DownloadSpaceService'
import { getFileFromPath } from './getFileFromPath'
import type { SyncReport, SyncIssues } from './types'
import { createPluginContext } from '@/plugins/context'

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
        const plugin = await loadPlugin(manifest.id)
        console.info(
          `[sync] checking plugin "${manifest.id}": canDownload=${plugin.canDownload}, hasScan=${Boolean(plugin.scanDownloadDir)}`,
        )
        if (!plugin.canDownload || !plugin.scanDownloadDir) continue

        const targetDir = await downloadSpaceService.getPluginDir(manifest.id)
        const scanResult = await downloadOrchestrator.scan(manifest.id)
        console.info(`[sync] scan result for "${manifest.id}":`, {
          downloaded: scanResult?.downloaded.size,
          onlyLocal: scanResult?.onlyLocal.length,
          missing: scanResult?.missing.length,
        })
        if (!scanResult) continue

        // Применяем результаты скана через writer
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

  dismissIssues(): void {
    this.issues.value = []
    this.issueCount.value = 0
  }
}

export const syncService = SyncService.getInstance()
