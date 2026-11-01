// src/services/collections/ensureTrackInLibrary.ts

import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { loadPlugin } from '@/plugins/registry';
import { createPluginContext } from '@/plugins/context';
import { buildLibraryIndex, merge, apply } from '@/services/library/TrackMerger';

/**
 * Гарантирует, что трек есть в библиотеке.
 * Возвращает актуальный trackId (может быть существующий или новый).
 */
export async function ensureTrackInLibrary(track: Track): Promise<TrackId> {
  const library = useLibraryStore();
  const uiSettings = useUiSettingsStore();
  const writer = createLibraryWriter();

  const incoming = {
    artist: track.artist,
    title: track.title,
    album: track.raw?.album ?? '',
    coverUrl: track.coverUrl,
    duration: track.duration,
    codec: track.codec,
    hasId3Tags: track.hasId3Tags,
    source: track.sources[0]!,
  };

  const mergeResult = merge(incoming, {
    libraryIndex: buildLibraryIndex(Object.values(library.tracks)),
    existingAlbums: Object.values(library.albums),
    threshold: uiSettings.playlistMatchThreshold,
  });

  await apply(mergeResult, {
    writer,
    saveCache: async () => {
      const pid = mergeResult.track.sources[0]?.pluginId;
      if (pid) {
        try {
          const plugin = await loadPlugin(pid);
          if (plugin.saveCache) {
            await plugin.saveCache(createPluginContext(pid));
          }
        } catch {}
      }
    },
  });

  return mergeResult.track.id;
}
