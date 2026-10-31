// src/services/metadata/runAutoFetch.ts

import { metadataService } from './MetadataService';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { isStreamingPlugin, pluginIdFromSource } from '@/plugins/registry';
import { useLibraryStore } from '@/stores/library';
import type { Track } from '@/types/track';

export async function runAutoFetch(track: Track): Promise<void> {
  const uiSettings = useUiSettingsStore();
  if (!uiSettings.autoFetchMetadata) return;

  // Стриминговые плагины не нуждаются в автопоиске
  const pluginIds = new Set(track.sources.map((s) => pluginIdFromSource(s.pluginId)));
  for (const pid of pluginIds) {
    if (isStreamingPlugin(pid)) return;
  }

  if (track.hasId3Tags) return;

  const library = useLibraryStore();
  const album = track.albumId ? library.getAlbum(track.albumId) : null;

  const hasArtist = track.artist.trim().length > 0;
  const hasAlbum = (album?.name?.trim().length ?? 0) > 0;
  const hasCover = Boolean(album?.coverUrl || track.coverUrl);

  if (hasArtist && hasAlbum && hasCover) return;

  // not-found (TTL не истёк) — не ищем
  const entry = metadataService.getEntry(track.id);
  if (entry && entry.artist === null) return;

  // ЕДИНЫЙ ПАЙПЛАЙН
  await metadataService.fetchAndApply(track.id);
}
