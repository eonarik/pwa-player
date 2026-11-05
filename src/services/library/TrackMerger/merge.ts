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
  sourceIndex?: Map<string, Track>;
}

export interface MergeManyResult {
  results: MergeResult[];
  albums: Album[];
}

/**
 * Ключ source для индекса.
 *
 * local: pluginId|handle.name|folderId — потому что два файла `track.mp3`
 * в разных папках — это разные файлы.
 *
 * cloud: pluginId|remotePath — remotePath уникален в пределах облака.
 *
 * streaming: pluginId|url.
 */
export function sourceKey(source: TrackSource): string {
  if (source.kind === 'local') {
    return `local|${source.pluginId}|${source.handle.name}|${source.folderId}`;
  }
  if (source.kind === 'cloud') {
    return `cloud|${source.pluginId}|${source.remotePath}`;
  }
  if (source.kind === 'streaming') {
    return `streaming|${source.pluginId}|${source.url}`;
  }
  const _exhaustive: never = source;
  return String(_exhaustive);
}

/**
 * Ищет единственный cloud-трек с совпадающим fileName.
 * Возвращает null, если найдено 0 или >1 (неоднозначность).
 *
 * Используется как fallback при `restoreFromLocalFiles`: local-трек
 * с handle.name='track.mp3' должен склеиться с cloud-треком,
 * у которого remotePath оканчивается на '/track.mp3', но только
 * если такой cloud-трек ровно один.
 */
function findUniqueCloudByFileName(sourceIndex: Map<string, Track>, fileName: string): Track | null {
  const matches: Track[] = [];
  const seen = new Set<TrackId>();

  for (const track of sourceIndex.values()) {
    if (seen.has(track.id)) continue;
    const hasMatch = track.sources.some((s) => s.kind === 'cloud' && s.remotePath.split('/').pop() === fileName);
    if (hasMatch) {
      seen.add(track.id);
      matches.push(track);
    }
  }

  return matches.length === 1 ? matches[0]! : null;
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

    // 2. local → cloud fallback по имени файла (только при однозначности)
    if (source.kind === 'local') {
      const fileName = source.handle.name;
      const existingByFileName = findUniqueCloudByFileName(ctx.sourceIndex, fileName);

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

    return {
      track: { ...bestMatch, sources: nextSources, albumId },
      action: 'merged-strict',
      album: albumRes?.album ?? null,
      matchedTrackId: bestMatch.id,
    };
  }

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
