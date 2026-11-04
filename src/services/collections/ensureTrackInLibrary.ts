// src/services/collections/ensureTrackInLibrary.ts

import type { Track } from '@/types/track';
import type { TrackId } from '@/types/ids';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { merge, apply, saveCachesForPlugins } from '@/services/library/TrackMerger';

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
    libraryIndex: library.tracksByArtist,
    existingAlbums: Object.values(library.albums),
    threshold: uiSettings.playlistMatchThreshold,
  });

  const pluginId = apply(mergeResult, { writer });
  if (pluginId) {
    await saveCachesForPlugins([pluginId]);
  }

  return mergeResult.track.id;
}
