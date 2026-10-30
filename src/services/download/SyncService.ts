// src/services/download/SyncService.ts

import { ref, shallowRef } from 'vue';
import { getPlugins, loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { createLibraryWriter } from '@/stores/library';
import { downloadOrchestrator } from './DownloadOrchestrator';
import { downloadSpaceService } from './DownloadSpaceService';
import { getFileHandleFromPath } from './getFileFromPath';
import { toastService } from '@/services/ui/ToastService';
import type { SyncReport, SyncIssues, SelectedIssues } from './types';
import type { TrackSource } from '@/types/track';
import { newTrackSourceId } from '@/types/ids';
import type { TrackId } from '@/types/ids';

class SyncService {
  private static instance: SyncService | null = null;

  readonly isSyncing = ref(false);
  readonly issues = shallowRef<SyncIssues[]>([]);
  readonly issueCount = ref(0);

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async scanPlugin(pluginId: string): Promise<void> {
    if (!downloadSpaceService.hasSpace.value) return;

    try {
      const plugin = await loadPlugin(pluginIdFromSource(pluginId));
      if (!plugin.scanDownloadDir || !plugin.canDownload) return;

      const targetDir = await downloadSpaceService.getPluginDir(pluginId);
      const scanResult = await downloadOrchestrator.scan(pluginId);
      if (!scanResult) return;

      const writer = createLibraryWriter();

      for (const [trackId, relativePath] of scanResult.downloaded) {
        const handle = await getFileHandleFromPath(targetDir, relativePath);
        if (!handle) continue;

        const track = writer.getTrack(trackId as TrackId);
        if (!track) continue;

        // Ищем cloud-source, чтобы взять folderId
        const cloudSource = track.sources.find((s) => s.kind === 'cloud');
        if (!cloudSource || cloudSource.kind !== 'cloud') continue;

        const localSource: TrackSource = {
          id: newTrackSourceId(),
          pluginId: cloudSource.pluginId,
          priority: 10,
          kind: 'local',
          handle,
          folderId: cloudSource.folderId,
        };
        const nextSources = [localSource, ...track.sources.filter((s) => s.kind !== 'local')].sort(
          (a, b) => a.priority - b.priority,
        );
        writer.updateTrackSources(trackId as TrackId, nextSources);
      }

      // Удаляем local-source у отсутствующих
      for (const trackId of scanResult.missing) {
        const track = writer.getTrack(trackId);
        if (!track) continue;
        const nextSources = track.sources.filter((s) => s.kind !== 'local');
        writer.updateTrackSources(trackId, nextSources);
      }

      if (plugin.saveCache) {
        const context = createPluginContext(pluginIdFromSource(pluginId));
        await plugin.saveCache(context);
      }
    } catch (err) {
      console.warn(`[sync] failed to scan plugin "${pluginId}"`, err);
    }
  }

  async syncAll(): Promise<SyncReport[]> {
    if (this.isSyncing.value) return [];

    if (!downloadSpaceService.hasSpace.value) {
      toastService.info('Папка скачивания не выбрана — синхронизировать нечего');
      return [];
    }

    this.isSyncing.value = true;
    const reports: SyncReport[] = [];
    const allIssues: SyncIssues[] = [];

    try {
      const writer = createLibraryWriter();
      let skippedWithoutFolders = 0;

      for (const manifest of getPlugins()) {
        try {
          const pluginTracks = writer
            .getAllTracks()
            .filter((t) => t.sources.some((s) => pluginIdFromSource(s.pluginId) === manifest.id));
          if (pluginTracks.length === 0) {
            skippedWithoutFolders++;
            continue;
          }

          const plugin = await loadPlugin(pluginIdFromSource(manifest.id));
          if (!plugin.canDownload || !plugin.scanDownloadDir) continue;

          const targetDir = await downloadSpaceService.getPluginDir(manifest.id);
          const scanResult = await downloadOrchestrator.scan(manifest.id);
          if (!scanResult) continue;

          for (const [trackId, relativePath] of scanResult.downloaded) {
            const handle = await getFileHandleFromPath(targetDir, relativePath);
            if (!handle) continue;

            const track = writer.getTrack(trackId);
            if (!track) continue;

            const cloudSource = track.sources.find((s) => s.kind === 'cloud');
            if (!cloudSource || cloudSource.kind !== 'cloud') continue;

            const localSource: TrackSource = {
              id: newTrackSourceId(),
              pluginId: cloudSource.pluginId,
              priority: 10,
              kind: 'local',
              handle,
              folderId: cloudSource.folderId,
            };
            const nextSources = [localSource, ...track.sources.filter((s) => s.kind !== 'local')].sort(
              (a, b) => a.priority - b.priority,
            );
            writer.updateTrackSources(trackId, nextSources);
          }

          for (const trackId of scanResult.missing) {
            const track = writer.getTrack(trackId);
            if (!track) continue;
            const nextSources = track.sources.filter((s) => s.kind !== 'local');
            writer.updateTrackSources(trackId, nextSources);
          }

          const issues: SyncIssues = {
            pluginId: manifest.id,
            onlyLocal: scanResult.onlyLocal,
            missing: scanResult.missing,
          };

          const hasIssues = scanResult.onlyLocal.length > 0 || scanResult.missing.length > 0;

          const report: SyncReport = {
            pluginId: manifest.id,
            downloaded: scanResult.downloaded.size,
            onlyLocalCount: scanResult.onlyLocal.length,
            missingCount: scanResult.missing.length,
            issues: hasIssues ? issues : null,
          };

          reports.push(report);
          if (hasIssues) allIssues.push(issues);

          if (plugin.saveCache) {
            await plugin.saveCache(createPluginContext(manifest.id));
          }
        } catch (err) {
          console.warn(`[sync] failed for plugin "${manifest.id}"`, err);
        }
      }

      if (reports.length === 0) {
        if (skippedWithoutFolders > 0) {
          toastService.info('Нет подключённых источников с папками. Откройте источник и повторите.');
        } else {
          toastService.info('Нечего синхронизировать');
        }
      }

      this.issues.value = allIssues;
      this.issueCount.value = allIssues.reduce((sum, i) => sum + i.onlyLocal.length + i.missing.length, 0);

      return reports;
    } finally {
      this.isSyncing.value = false;
    }
  }

  async resolveIssues(selected: SelectedIssues): Promise<void> {
    const writer = createLibraryWriter();

    // onlyLocal — создаём локальные треки
    const byPlugin = new Map<string, SelectedIssues['onlyLocal']>();
    for (const item of selected.onlyLocal) {
      const list = byPlugin.get(item.pluginId) ?? [];
      list.push(item);
      byPlugin.set(item.pluginId, list);
    }

    for (const [pluginId, items] of byPlugin) {
      try {
        const plugin = await loadPlugin(pluginId);
        if (!plugin.createLocalTrack) continue;

        const context = createPluginContext(pluginId);

        for (const item of items) {
          const track = await plugin.createLocalTrack(context, item.relativePath, item.filename);
          if (track) {
            writer.addTracks([track], pluginId);
          }
        }

        if (plugin.saveCache) {
          await plugin.saveCache(context);
        }
      } catch (err) {
        console.error(`[sync] failed to create local tracks for "${pluginId}"`, err);
      }
    }

    // missing — удаляем local-source
    for (const item of selected.missing) {
      const track = writer.getTrack(item.trackId);
      if (!track) continue;
      const nextSources = track.sources.filter((s) => s.kind !== 'local');
      writer.updateTrackSources(item.trackId, nextSources);
    }

    this.dismissIssues();
  }

  dismissIssues(): void {
    this.issues.value = [];
    this.issueCount.value = 0;
  }
}

export const syncService = SyncService.getInstance();
