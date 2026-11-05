// src/services/library/TrackMerger/merge.ts

import type { Track, TrackSource } from '@/types/track';
import type { Album } from '@/types/album';
import type { RawMetadata, MetadataCandidate } from '@/types/metadata';
import type { PluginTrackPayload } from '@/types/plugin';
import type { AlbumId, TrackId } from '@/types/ids';
import { newMetadataCandidateId, newTrackId, newTrackSourceId } from '@/types/ids';
import { findBestMatch } from '@/services/playlists/PlaylistMatcher';
import { resolveAlbumByName } from '../EntityGraph';
import { isSameSource, isStrictMatch } from './utils';

export type MergeAction = 'created' | 'merged-strict' | 'merged-soft';

export interface MergeResult {
  track: Track;
  action: MergeAction;
  album: Album | null;
  matchedTrackId: TrackId | null;
}

export interface MergeContext {
  libraryIndex: Map<string, Track[]>;
  existingAlbums: Album[];
  threshold: number;
  /**
   * Индекс существующих треков по source (для защиты от дубликатов при повторном скане).
   * Ключ: pluginId|kind|remotePath/handle.name/url.
   */
  sourceIndex?: Map<string, Track>;
}

export interface MergeManyResult {
  results: MergeResult[];
  albums: Album[];
}

export function sourceKey(source: TrackSource): string {
  if (source.kind === 'local') {
    // handle.name уникален в пределах FS. folderId — не часть идентичности.
    return `local|${source.pluginId}|${source.handle.name}`;
  }
  if (source.kind === 'cloud') {
    return `cloud|${source.pluginId}|${source.remotePath}`;
  }
  if (source.kind === 'streaming') {
    return `streaming|${source.pluginId}|${source.url}`;
  }
  // exhaustive
  const _exhaustive: never = source;
  return String(_exhaustive);
}

export function merge(incoming: PluginTrackPayload, ctx: MergeContext): MergeResult {
  const sourceWithoutId = incoming.source;
  const source: TrackSource = {
    ...sourceWithoutId,
    id: newTrackSourceId(),
  } as TrackSource;

  const isVoidSource = source.kind === 'streaming' && !source.url;

  const raw: RawMetadata = {
    artist: incoming.artist,
    title: incoming.title,
    album: incoming.album,
    coverUrl: incoming.coverUrl,
  };

  // --- ЗАЩИТА ОТ ДУБЛИКАТОВ: ищем по source ---
  if (!isVoidSource && ctx.sourceIndex) {
    // 1. Прямое совпадение по sourceKey
    const key = sourceKey(source);
    const existingBySource = ctx.sourceIndex.get(key);

    if (existingBySource) {
      const alreadyHasSource = existingBySource.sources.some((s) => isSameSource(s, source));
      const nextSources = alreadyHasSource
        ? existingBySource.sources
        : [...existingBySource.sources, source].sort((a, b) => a.priority - b.priority);

      return {
        track: { ...existingBySource, sources: nextSources },
        action: 'merged-strict',
        album: null,
        matchedTrackId: existingBySource.id,
      };
    }

    // 2. Специальный случай: local source + существующий cloud source с тем же именем файла
    //    (например, при restoreFromLocalFiles, когда cloud уже был удалён/отключён, но трек остался)
    if (source.kind === 'local') {
      const fileName = source.handle.name;
      let existingByFileName: Track | undefined;

      for (const track of ctx.sourceIndex.values()) {
        // Ищем трек, у которого есть cloud source с тем же fileName
        const hasMatchingCloud = track.sources.some(
          (s) => s.kind === 'cloud' && s.remotePath.split('/').pop() === fileName,
        );
        if (hasMatchingCloud) {
          existingByFileName = track;
          break;
        }
      }

      if (existingByFileName) {
        const alreadyHasSource = existingByFileName.sources.some((s) => isSameSource(s, source));
        const nextSources = alreadyHasSource
          ? existingByFileName.sources
          : [...existingByFileName.sources, source].sort((a, b) => a.priority - b.priority);

        return {
          track: { ...existingByFileName, sources: nextSources },
          action: 'merged-strict',
          album: null,
          matchedTrackId: existingByFileName.id,
        };
      }
    }
  }

  const incomingProbe: Track = {
    id: '' as TrackId,
    pluginId: source.pluginId,
    artist: incoming.artist,
    title: incoming.title,
    albumId: null,
    coverUrl: incoming.coverUrl,
    sources: isVoidSource ? [] : [source],
    metadataCandidates: [],
    raw,
    hasId3Tags: incoming.hasId3Tags,
    duration: incoming.duration,
    codec: incoming.codec,
  };

  const { track: bestMatch, score } = findBestMatch(incomingProbe, ctx.libraryIndex, ctx.threshold);

  // --- created ---
  if (!bestMatch || score < ctx.threshold) {
    const albumRes = resolveAlbumByName(incoming.album, incoming.artist, incoming.coverUrl, ctx.existingAlbums);
    const albumId: AlbumId | null = albumRes?.album.id ?? null;
    const track: Track = {
      id: newTrackId(),
      pluginId: source.pluginId,
      artist: incoming.artist,
      title: incoming.title,
      albumId,
      coverUrl: albumId ? null : incoming.coverUrl,
      sources: isVoidSource ? [] : [source],
      metadataCandidates: [],
      raw,
      hasId3Tags: incoming.hasId3Tags,
      metaSource: incoming.metaSource,
      hasMetadataEdits: incoming.hasMetadataEdits,
      duration: incoming.duration,
      codec: incoming.codec,
    };
    return {
      track,
      action: 'created',
      album: albumRes?.album ?? null,
      matchedTrackId: null,
    };
  }

  // --- merged-strict ---
  if (isStrictMatch(incomingProbe, bestMatch)) {
    const alreadyHasSource = isVoidSource || bestMatch.sources.some((s) => isSameSource(s, source));
    const nextSources = alreadyHasSource
      ? bestMatch.sources
      : [...bestMatch.sources, source].sort((a, b) => a.priority - b.priority);

    let albumRes: { album: Album; isNew: boolean } | null = null;
    let albumId: AlbumId | null = bestMatch.albumId;
    if (!albumId && incoming.album.trim()) {
      albumRes = resolveAlbumByName(incoming.album, incoming.artist, incoming.coverUrl, ctx.existingAlbums);
      albumId = albumRes?.album.id ?? null;
    }

    const track: Track = {
      ...bestMatch,
      sources: nextSources,
      albumId,
    };

    return {
      track,
      action: 'merged-strict',
      album: albumRes?.album ?? null,
      matchedTrackId: bestMatch.id,
    };
  }

  // --- merged-soft ---
  const albumRes = resolveAlbumByName(incoming.album, incoming.artist, incoming.coverUrl, ctx.existingAlbums);
  const albumId: AlbumId | null = albumRes?.album.id ?? null;

  const candidate: MetadataCandidate = {
    id: newMetadataCandidateId(),
    artist: incoming.artist,
    title: incoming.title,
    album: incoming.album,
    coverUrl: incoming.coverUrl,
    similarity: score,
    provider: incoming.provider ?? 'unknown',
    extMetadata: {
      mergeWithTrackId: bestMatch.id,
    },
  };

  const track: Track = {
    id: newTrackId(),
    pluginId: source.pluginId,
    artist: incoming.artist,
    title: incoming.title,
    albumId,
    coverUrl: albumId ? null : incoming.coverUrl,
    sources: isVoidSource ? [] : [source],
    metadataCandidates: [candidate],
    raw,
    hasId3Tags: incoming.hasId3Tags,
    metaSource: incoming.metaSource,
    hasMetadataEdits: incoming.hasMetadataEdits,
    duration: incoming.duration,
    codec: incoming.codec,
  };

  return {
    track,
    action: 'merged-soft',
    album: albumRes?.album ?? null,
    matchedTrackId: bestMatch.id,
  };
}

export function mergeMany(incoming: PluginTrackPayload[], ctx: MergeContext): MergeManyResult {
  const results: MergeResult[] = [];
  const albums = new Map<AlbumId, Album>(ctx.existingAlbums.map((a) => [a.id, a]));

  const libraryIndex = new Map<string, Track[]>();
  for (const [key, list] of ctx.libraryIndex) {
    libraryIndex.set(key, [...list]);
  }

  // sourceIndex мутируется, чтобы новые created треки тоже попадали в него.
  const sourceIndex = new Map<string, Track>(ctx.sourceIndex ?? []);

  for (const payload of incoming) {
    const result = merge(payload, {
      libraryIndex,
      existingAlbums: Array.from(albums.values()),
      threshold: ctx.threshold,
      sourceIndex,
    });

    results.push(result);

    const artistKey = (result.track.artist || '').trim().toLowerCase();
    const list = libraryIndex.get(artistKey) || [];
    if (!list.some((t) => t.id === result.track.id)) {
      list.push(result.track);
      libraryIndex.set(artistKey, list);
    }

    // Обновляем sourceIndex
    if (result.action === 'created' || result.action === 'merged-soft') {
      if (result.track.sources[0]) {
        sourceIndex.set(sourceKey(result.track.sources[0]), result.track);
      }
    } else if (result.action === 'merged-strict' && result.track.sources.length > 0) {
      for (const s of result.track.sources) {
        sourceIndex.set(sourceKey(s), result.track);
      }
    }

    if (result.album) {
      albums.set(result.album.id, result.album);
    }
  }

  return {
    results,
    albums: Array.from(albums.values()),
  };
}
