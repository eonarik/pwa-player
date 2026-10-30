// src/services/metadata/runAutoFetch.ts

import { isStreamingPlugin, loadPlugin, pluginIdFromSource } from '@/plugins/registry';
import { trackMetadataService } from './TrackMetadataService';
import { metadataService } from './MetadataService';
import { useLibraryStore } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import type { Track } from '@/types/track';

/**
 * Ищет метаданные для трека в фоне.
 * Сначала пробует СберЗвук (если включено в настройках плагина),
 * затем iTunes и Deezer.
 */
export async function runAutoFetch(track: Track): Promise<void> {
  const uiSettings = useUiSettingsStore();
  if (!uiSettings.autoFetchMetadata) return;

  // Стриминговые плагины (СберЗвук, Радио) не нуждаются в автопоиске для своих треков
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

  // 1. ПЫТАЕМСЯ НАЙТИ В СБЕРЗВУКЕ (если плагин включен)
  const zvukEnabled = localStorage.getItem('zvuk:fetchMetadata') !== 'false';
  if (zvukEnabled) {
    try {
      const zvukPlugin = await loadPlugin('zvuk');
      if (zvukPlugin.fetchMetadata) {
        const zvukData = await zvukPlugin.fetchMetadata(track.artist, track.title);
        if (zvukData) {
          console.info(`[auto-fetch] Found metadata in Zvuk for "${track.title}"`);
          metadataService.applyRemote(track.id, {
            artist: zvukData.artist,
            title: zvukData.title,
            album: zvukData.album,
            coverUrl: zvukData.coverUrl,
            source: 'zvuk',
            similarity: zvukData.similarity,
            confident: zvukData.confident,
          });
          return; // Нашли в Звуке — выходим, iTunes не тревожим
        }
      }
    } catch (err) {
      console.warn('[auto-fetch] zvuk failed', err);
    }
  }

  // 2. ЕСЛИ В ЗВУКЕ НЕ НАШЛИ — ИДЕМ В ITUNES/DEEZER
  try {
    const result = await trackMetadataService.fetch(track.artist, track.title, uiSettings.metadataThreshold);

    if (result.status === 'found') {
      metadataService.applyRemote(track.id, result.data);
    } else if (result.status === 'not-found') {
      metadataService.markNotFound(track.id);
    }
  } catch (err) {
    console.warn('[auto-fetch] failed', err);
  }
}
