// src/composables/useAutoActions.ts

import { watch, type Ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { metadataService } from '@/services/metadata/MetadataService';
import { metadataWorkerService } from '@/services/metadata/MetadataWorkerService';
import { runAutoFetch } from '@/services/metadata/runAutoFetch';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator';
import { pluginCanDownload, isStreamingPlugin, pluginIdFromSource } from '@/plugins/registry';
import { hasLocalSource } from '@/services/library/selectors';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import type { Track } from '@/types/track';

export function useAutoActions(currentTrack: Ref<Track | null>) {
  const library = useLibraryStore();
  const uiSettings = useUiSettingsStore();

  const processedTracks = new Set<string>();

  watch(currentTrack, async (track) => {
    if (!track) return;

    const pluginIds = new Set(track.sources.map((s) => pluginIdFromSource(s.pluginId)));
    for (const pid of pluginIds) {
      if (isStreamingPlugin(pid)) return;
    }

    if (processedTracks.has(track.id)) return;
    processedTracks.add(track.id);

    const libTrack = library.getTrack(track.id);
    if (!libTrack) return;

    // 1. Парсинг локального файла (только если тегов нет)
    const localSource = libTrack.sources.find((s) => s.kind === 'local');
    if (localSource && localSource.kind === 'local' && !libTrack.hasId3Tags) {
      try {
        const file = await localSource.handle.getFile();
        const parsed = await metadataWorkerService.parse(file);

        if (parsed) {
          metadataService.applyFromFile(libTrack.id, parsed);
          return;
        }

        const guessed = guessMetadataFromFilename(file.name);
        const writer = (await import('@/stores/library')).createLibraryWriter();
        writer.updateTrackMetadata(libTrack.id, {
          title: guessed.title || libTrack.title,
          artist: guessed.artist || libTrack.artist,
          hasId3Tags: false,
        });
        usePlayerStore().updateTrackInQueue(libTrack.id);

        const updated = library.getTrack(libTrack.id);
        if (updated) void runAutoFetch(updated);
        return;
      } catch (err) {
        console.error('[auto-actions] failed to parse local track metadata', err);
      }
    }

    // 2. Автопоиск
    void runAutoFetch(libTrack);

    // 3. Автоскачивание
    const isDownloading = downloadOrchestrator.isDownloading(libTrack.id);
    const cloudPluginId = libTrack.sources.find((s) => s.kind === 'cloud')?.pluginId;
    const isWaitingForDownload =
      uiSettings.autoDownloadTracks &&
      cloudPluginId !== undefined &&
      pluginCanDownload(cloudPluginId) &&
      !hasLocalSource(libTrack) &&
      !isDownloading;

    if (isWaitingForDownload && downloadSpaceService.hasSpace.value && !downloadSpaceService.needsPermission.value) {
      void downloadOrchestrator.downloadTrack(libTrack).catch((err) => {
        console.warn('[auto-actions] auto-download failed', err);
      });
    }
  });
}
