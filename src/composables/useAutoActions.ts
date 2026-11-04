// src/composables/useAutoActions.ts

import { watch } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { metadataService } from '@/services/metadata/MetadataService';
import { metadataWorkerService } from '@/services/metadata/MetadataWorkerService';
import { runAutoFetch } from '@/services/metadata/runAutoFetch';
import { downloadSpaceService } from '@/services/download/DownloadSpaceService';
import { downloadOrchestrator } from '@/services/download/DownloadOrchestrator';
import {
  pluginCanDownload,
  isStreamingPlugin,
  isLinearContent,
  isLiveStream,
  pluginIdFromSource,
} from '@/plugins/registry';
import { hasLocalSource } from '@/services/library/selectors';
import { guessMetadataFromFilename } from '@/utils/parseFilename';
import { isProcessed, markProcessed, resetProcessedTrack } from '@/services/metadata/AutoFetchRegistry';

export function useAutoActions() {
  const player = usePlayerStore();
  const library = useLibraryStore();
  const uiSettings = useUiSettingsStore();

  watch(
    () => player.playbackVersion,
    async () => {
      const track = player.currentTrack;

      if (!track) return;

      const album = track.albumId ? library.getAlbum(track.albumId) : null;
      const hasCover = Boolean(album?.coverBlob || album?.coverUrl || track.coverUrl);

      if (track.hasMetadataEdits && hasCover) {
        return;
      }

      const pluginIds = new Set(track.sources.map((s) => pluginIdFromSource(s.pluginId)));
      for (const pid of pluginIds) {
        if (isStreamingPlugin(pid) || isLinearContent(pid) || isLiveStream(pid)) {
          return;
        }
      }

      if (isProcessed(track.id)) {
        return;
      }
      markProcessed(track.id);

      const libTrack = library.getTrack(track.id);
      if (!libTrack) return;

      const localSource = libTrack.sources.find((s) => s.kind === 'local');
      if (localSource && localSource.kind === 'local' && !libTrack.hasId3Tags) {
        try {
          const file = await localSource.handle.getFile();
          const parsed = await metadataWorkerService.parse(file);

          if (parsed) {
            metadataService.applyFromFile(libTrack.id, parsed.metadata, parsed.coverBlob);

            const updated = library.getTrack(libTrack.id);
            if (updated && !updated.hasMetadataEdits) {
              try {
                await runAutoFetch(updated);
              } catch (err) {
                console.warn('[auto-actions] runAutoFetch failed (local), will retry next time', err);
                resetProcessedTrack(track.id);
              }
            }
            return;
          }

          const guessed = guessMetadataFromFilename(file.name);
          const writer = (await import('@/stores/library')).createLibraryWriter();
          writer.updateTrackMetadata(libTrack.id, {
            title: guessed.title || libTrack.title,
            artist: guessed.artist || libTrack.artist,
            hasId3Tags: false,
            metaSource: 'filename',
          });
          player.updateTrackInQueue(libTrack.id);

          const updated = library.getTrack(libTrack.id);
          if (updated) {
            try {
              await runAutoFetch(updated);
            } catch (err) {
              console.warn('[auto-actions] runAutoFetch failed (local), will retry next time', err);
              resetProcessedTrack(track.id);
            }
          }
          return;
        } catch (err) {
          console.error('[auto-actions] failed to parse local track metadata', err);
          resetProcessedTrack(track.id);
        }
      }

      try {
        await runAutoFetch(libTrack);
      } catch (err) {
        console.warn('[auto-actions] runAutoFetch failed, will retry next time', err);
        resetProcessedTrack(track.id);
      }

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
    },
  );
}
