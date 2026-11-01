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
}

export interface MergeManyResult {
  results: MergeResult[];
  albums: Album[];
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

  const candidate: MetadataCandidate = {
    id: newMetadataCandidateId(),
    artist: incoming.artist,
    title: incoming.title,
    album: incoming.album,
    coverUrl: incoming.coverUrl,
    similarity: score,
    provider: incoming.provider ?? 'unknown',
  };

  const alreadyHasCandidate = bestMatch.metadataCandidates.some(
    (c) =>
      c.artist.trim().toLowerCase() === candidate.artist.trim().toLowerCase() &&
      c.title.trim().toLowerCase() === candidate.title.trim().toLowerCase(),
  );

  const track: Track = alreadyHasCandidate
    ? bestMatch
    : {
        ...bestMatch,
        metadataCandidates: [...bestMatch.metadataCandidates, candidate],
      };

  return {
    track,
    action: 'merged-soft',
    album: null,
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

  for (const payload of incoming) {
    const result = merge(payload, {
      libraryIndex,
      existingAlbums: Array.from(albums.values()),
      threshold: ctx.threshold,
    });

    results.push(result);

    const artistKey = (result.track.artist || '').trim().toLowerCase();
    const list = libraryIndex.get(artistKey) || [];
    if (!list.some((t) => t.id === result.track.id)) {
      list.push(result.track);
      libraryIndex.set(artistKey, list);
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
