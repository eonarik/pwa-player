// src/services/library/TrackMerger.ts

import type { Track, TrackSource } from '@/types/track';
import type { Album } from '@/types/album';
import type { RawMetadata, MetadataCandidate } from '@/types/metadata';
import type { PluginTrackPayload } from '@/types/plugin';
import type { AlbumId, TrackId } from '@/types/ids';
import { newAlbumId, newMetadataCandidateId, newTrackId, newTrackSourceId } from '@/types/ids';
import { findBestMatch } from '@/services/playlists/PlaylistMatcher';
import { resolveAlbumByName } from './EntityGraph';
import type { LibraryWriter } from '@/services/library/LibraryWriter';

export type MergeAction = 'created' | 'merged-strict' | 'merged-soft';

export interface MergeResult {
  track: Track;
  action: MergeAction;
  album: Album | null;
  matchedTrackId: TrackId | null;
}

export interface MergeContext {
  existingTracks: Track[];
  existingAlbums: Album[];
  threshold: number;
}

export interface MergeManyResult {
  results: MergeResult[];
  albums: Album[];
}

function isSameSource(a: TrackSource, b: TrackSource): boolean {
  if (a.pluginId !== b.pluginId) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'local' && b.kind === 'local') {
    // Сравниваем и имя файла, и папку
    return a.handle.name === b.handle.name && a.folderId === b.folderId;
  }
  if (a.kind === 'cloud' && b.kind === 'cloud') {
    return a.remotePath === b.remotePath;
  }
  if (a.kind === 'streaming' && b.kind === 'streaming') {
    return a.url === b.url;
  }
  return false;
}

/**
 * Строгий мэтч: только если artist и title совпадают ПОБАЙТОВО
 */
function isStrictMatch(incoming: Track, existing: Track): boolean {
  const inArtist = incoming.artist.trim().toLowerCase();
  const exArtist = existing.artist.trim().toLowerCase();
  const inTitle = incoming.title.trim().toLowerCase();
  const exTitle = existing.title.trim().toLowerCase();

  return inArtist === exArtist && inTitle === exTitle;
}

function trackToPayload(track: Track): PluginTrackPayload {
  const firstSource = track.sources[0];
  if (!firstSource) {
    throw new Error(`[TrackMerger] track "${track.id}" has no sources`);
  }
  const { id: _id, ...sourceWithoutId } = firstSource;
  return {
    artist: track.artist,
    title: track.title,
    album: track.raw?.album ?? '',
    coverUrl: track.coverUrl ?? track.raw?.coverUrl ?? null,
    duration: track.duration,
    codec: track.codec,
    hasId3Tags: track.hasId3Tags,
    provider: undefined,
    source: sourceWithoutId,
  };
}

export function merge(incoming: PluginTrackPayload, ctx: MergeContext): MergeResult {
  const sourceWithoutId = incoming.source;
  const source: TrackSource = {
    ...sourceWithoutId,
    id: newTrackSourceId(),
  } as TrackSource;

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
    sources: [source],
    metadataCandidates: [],
    raw,
    hasId3Tags: incoming.hasId3Tags,
    duration: incoming.duration,
    codec: incoming.codec,
  };

  // 1. Ищем лучшее совпадение (fuzzy)
  const { track: bestMatch, score } = findBestMatch(incomingProbe, ctx.existingTracks, ctx.threshold);

  // 2. Нет мэтча вообще — создаем новый
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
      sources: [source],
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

  // 3. Есть мэтч. Проверяем, строгий ли он.
  if (isStrictMatch(incomingProbe, bestMatch)) {
    const alreadyHasSource = bestMatch.sources.some((s) => isSameSource(s, source));
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

  // 4. Нестрогий мэтч (fuzzy): складываем в metadataCandidates
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
  const tracks = new Map<TrackId, Track>(ctx.existingTracks.map((t) => [t.id, t]));

  for (const payload of incoming) {
    const result = merge(payload, {
      existingTracks: Array.from(tracks.values()),
      existingAlbums: Array.from(albums.values()),
      threshold: ctx.threshold,
    });

    results.push(result);
    tracks.set(result.track.id, result.track);
    if (result.album) {
      albums.set(result.album.id, result.album);
    }
  }

  return {
    results,
    albums: Array.from(albums.values()),
  };
}

export interface ApplyDeps {
  writer: LibraryWriter;
  saveCache: (pluginId: string) => Promise<void>;
}

export async function apply(result: MergeResult, deps: ApplyDeps): Promise<void> {
  const { writer, saveCache } = deps;
  const pluginId = result.track.sources[0]?.pluginId;

  if (result.action === 'created') {
    if (result.album) {
      writer.addAlbums([result.album]);
    }
    writer.addTracks([result.track], pluginId ?? '');
  } else if (result.action === 'merged-strict') {
    if (result.album) {
      writer.addOrUpdateAlbum(result.album);
    }
    writer.updateTrackSources(result.track.id, result.track.sources);
    if (result.track.albumId !== null) {
      writer.updateTrackAlbumId(result.track.id, result.track.albumId);
    }
  } else if (result.action === 'merged-soft') {
    writer.updateTrackMetadataCandidates(result.track.id, result.track.metadataCandidates);
  }

  if (pluginId) {
    await saveCache(pluginId);
  }
}

export interface ApplyManyDeps {
  writer: LibraryWriter;
  saveCache: (pluginId: string) => Promise<void>;
}

export async function applyMany(many: MergeManyResult, deps: ApplyManyDeps): Promise<void> {
  const { writer, saveCache } = deps;

  if (many.albums.length > 0) {
    writer.addAlbums(many.albums);
  }

  const createdTracks: Track[] = [];
  const pluginIds = new Set<string>();

  // 1. Сначала собираем созданные
  for (const result of many.results) {
    if (result.action === 'created') {
      createdTracks.push(result.track);
      const pid = result.track.sources[0]?.pluginId;
      if (pid) pluginIds.add(pid);
    }
  }

  // 2. Добавляем созданные треки в БД
  if (createdTracks.length > 0) {
    const byPlugin = new Map<string, Track[]>();
    for (const track of createdTracks) {
      const pid = track.sources[0]?.pluginId ?? '';
      const list = byPlugin.get(pid) ?? [];
      list.push(track);
      byPlugin.set(pid, list);
    }
    for (const [pid, tracks] of byPlugin) {
      writer.addTracks(tracks, pid);
    }
  }

  // 3. Теперь обновляем склеенные (они уже есть в БД)
  for (const result of many.results) {
    if (result.action === 'merged-strict') {
      writer.updateTrackSources(result.track.id, result.track.sources);
      if (result.track.albumId !== null) {
        writer.updateTrackAlbumId(result.track.id, result.track.albumId);
      }
      const pid = result.track.sources[0]?.pluginId;
      if (pid) pluginIds.add(pid);
    } else if (result.action === 'merged-soft') {
      writer.updateTrackMetadataCandidates(result.track.id, result.track.metadataCandidates);
      const pid = result.track.sources[0]?.pluginId;
      if (pid) pluginIds.add(pid);
    }
  }

  for (const pid of pluginIds) {
    await saveCache(pid);
  }
}

export interface ReconcileDeps {
  writer: LibraryWriter;
  saveCache: (pluginId: string) => Promise<void>;
  replaceTrackId: (oldId: TrackId, newId: TrackId) => Promise<void>;
  threshold: number;
}

export async function reconcile(deps: ReconcileDeps): Promise<void> {
  const { writer, saveCache, replaceTrackId, threshold } = deps;
  const allTracks = writer.getAllTracks();

  const virtual = allTracks.filter((t) => !t.sources.some((s) => s.kind === 'local'));
  if (virtual.length === 0) return;

  const targets = allTracks.filter((t) => t.sources.some((s) => s.kind === 'local'));
  if (targets.length === 0) return;

  for (const v of virtual) {
    const result = merge(trackToPayload(v), {
      existingTracks: targets,
      existingAlbums: writer.getAllAlbums(),
      threshold,
    });

    if (result.action === 'merged-strict' && result.matchedTrackId !== null && result.matchedTrackId !== v.id) {
      const targetId = result.matchedTrackId;
      const target = writer.getTrack(targetId);
      if (!target) continue;

      const mergedSources = target.sources;
      const newSources = v.sources.filter((vs) => !mergedSources.some((ms) => isSameSource(ms, vs)));

      if (newSources.length > 0) {
        const nextSources = [...mergedSources, ...newSources].sort((a, b) => a.priority - b.priority);
        writer.updateTrackSources(targetId, nextSources);
      }

      await replaceTrackId(v.id, targetId);
      writer.removeTrack(v.id);

      await saveCache(target.sources[0]?.pluginId ?? '');
    }
  }
}

export { newTrackId, newAlbumId, newTrackSourceId, newMetadataCandidateId };
