// src/services/playlists/ImportService.ts

import { usePlaylistsStore } from '@/stores/playlists';
import { useLibraryStore, createLibraryWriter } from '@/stores/library';
import { useUiSettingsStore } from '@/stores/uiSettings';
import { findBestMatch } from '@/services/playlists/PlaylistMatcher';
import { merge, apply, buildLibraryIndex } from '@/services/library/TrackMerger';
import { detectPlaylistFormat, parseM3U, parseJSON } from '@/utils/playlistParser';
import { decodeBlueprint, type BlueprintData } from '@/utils/playlistBlueprint';
import type { PlaylistExportTrack } from '@/types/collection';
import type { PlaylistId, TrackId } from '@/types/ids';

export interface ImportStats {
  total: number;
  exact: number;
  fuzzy: number;
  unmatched: number;
}

export interface ImportResult {
  playlistId: PlaylistId;
  stats: ImportStats;
}

export interface ParsedPlaylist {
  name: string;
  tracks: PlaylistExportTrack[];
}

/**
 * Парсит сырой текст и возвращает нормализованный плейлист.
 * Поддерживает CUEI1:, M3U и JSON.
 * Возвращает null, если формат не распознан или данные битые.
 */
export async function parsePlaylistText(
  text: string,
  fallbackName = 'Импортированный плейлист',
): Promise<ParsedPlaylist | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 1. Blueprint (CUEI1:)
  if (trimmed.startsWith('CUEI1:')) {
    const blueprint = await decodeBlueprint(trimmed);
    if (!blueprint) return null;
    return blueprintToParsed(blueprint, fallbackName);
  }

  // 2. M3U / JSON
  const format = detectPlaylistFormat(trimmed);
  if (format === 'json') {
    const parsed = parseJSON(trimmed);
    if (!parsed) return null;
    return { name: parsed.name || fallbackName, tracks: parsed.tracks };
  }
  if (format === 'm3u') {
    const parsed = parseM3U(trimmed);
    if (parsed.length === 0) return null;
    return { name: fallbackName, tracks: parsed };
  }

  return null;
}

function blueprintToParsed(bp: BlueprintData, fallbackName: string): ParsedPlaylist {
  return {
    name: bp.n?.trim() || fallbackName,
    tracks: bp.tr.map((t) => ({
      artist: t.a || '',
      title: t.t || 'Unknown Title',
      album: t.al,
      duration: t.d,
      path: undefined,
    })),
  };
}

/**
 * Создаёт плейлист из распарсенных треков.
 * Пытается найти точные и fuzzy-совпадения в библиотеке.
 * Если не находит — создаёт виртуальный трек (pluginId='imported', пустые sources).
 */
export async function importPlaylist(parsed: ParsedPlaylist): Promise<ImportResult> {
  const playlists = usePlaylistsStore();
  const library = useLibraryStore();
  const uiSettings = useUiSettingsStore();
  const writer = createLibraryWriter();

  const playlistId = playlists.createPlaylist(parsed.name);
  const playlist = playlists.getPlaylist(playlistId);
  if (!playlist) {
    throw new Error('[import] failed to create playlist');
  }

  const allTracks = Object.values(library.tracks);
  const libraryIndex = buildLibraryIndex(allTracks);
  const threshold = uiSettings.playlistMatchThreshold;

  const stats: ImportStats = {
    total: parsed.tracks.length,
    exact: 0,
    fuzzy: 0,
    unmatched: 0,
  };

  const trackIdsSet = new Set<TrackId>();

  for (const t of parsed.tracks) {
    const incomingArtist = (t.artist || '').trim();
    const incomingTitle = (t.title || '').trim();

    if (!incomingTitle) continue;

    // 1. Точное совпадение по artist+title
    const exactMatch = allTracks.find(
      (libTrack) =>
        libTrack.title.toLowerCase().trim() === incomingTitle.toLowerCase() &&
        libTrack.artist.toLowerCase().trim() === incomingArtist.toLowerCase(),
    );

    if (exactMatch) {
      stats.exact++;
      trackIdsSet.add(exactMatch.id);
      continue;
    }

    // 2. Fuzzy-поиск
    const bestMatch = findBestMatch(t, libraryIndex, threshold);
    if (bestMatch.track) {
      stats.fuzzy++;
      trackIdsSet.add(bestMatch.track.id);
      continue;
    }

    // 3. Не найдено — создаём виртуальный трек
    stats.unmatched++;

    const dummySource = {
      pluginId: 'imported',
      priority: 999,
      kind: 'streaming' as const,
      url: '',
    };

    const mergeResult = merge(
      {
        artist: incomingArtist,
        title: incomingTitle,
        album: t.album || '',
        coverUrl: null,
        hasId3Tags: false,
        source: dummySource,
      },
      {
        libraryIndex,
        existingAlbums: Object.values(library.albums),
        threshold,
      },
    );

    await apply(mergeResult, {
      writer,
      saveCache: async () => {},
    });

    // Добавляем в индекс, чтобы следующие треки могли с ним склеиться
    const artistKey = (mergeResult.track.artist || '').trim().toLowerCase();
    const list = libraryIndex.get(artistKey) || [];
    if (!list.some((tr) => tr.id === mergeResult.track.id)) {
      list.push(mergeResult.track);
      libraryIndex.set(artistKey, list);
    }

    trackIdsSet.add(mergeResult.track.id);
  }

  playlist.trackIds = Array.from(trackIdsSet);
  playlist.updatedAt = Date.now();
  playlists.save();

  return { playlistId, stats };
}
