// src/services/library/TrackMerger/merge-same-title.spec.ts

import { describe, it, expect } from 'vitest';
import { merge, mergeMany, sourceKey, buildLibraryIndex, type MergeContext } from './index';
import type { Track, LocalTrackSource, TrackSource } from '@/types/track';
import type { PluginTrackPayload } from '@/types/plugin';
import type { FolderId } from '@/types/ids';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';

function makeExistingTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist',
    title: 'Title',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

function makeLocalSource(name: string, folderId: FolderId): TrackSource {
  return {
    id: newTrackSourceId(),
    pluginId: 'local',
    priority: 10,
    kind: 'local',
    handle: { name } as FileSystemFileHandle,
    folderId,
  };
}

function makeIncomingSource(name: string, folderId: FolderId): Omit<LocalTrackSource, 'id'> {
  return {
    pluginId: 'local',
    priority: 10,
    kind: 'local',
    handle: { name } as FileSystemFileHandle,
    folderId,
  };
}

function makeIncomingPayload(artist: string, title: string, name: string, folderId: FolderId): PluginTrackPayload {
  return {
    artist,
    title,
    album: '',
    coverUrl: null,
    hasId3Tags: true,
    source: makeIncomingSource(name, folderId),
  };
}

// ---------------------------------------------------------------------------
// СЦЕНАРИЙ 1: mergeMany — один и тот же файл в разных папках
// ---------------------------------------------------------------------------

describe('mergeMany: одинаковый файл в разных папках', () => {
  it('ДОЛЖЕН склеить два payload с одинаковым artist/title в разных папках', () => {
    const folderA = newFolderId();
    const folderB = newFolderId();

    const payloadA = makeIncomingPayload('Konstantin Stupin', 'Kogda ya umer', 'track.mp3', folderA);
    const payloadB = makeIncomingPayload('Konstantin Stupin', 'Kogda ya umer', 'track.mp3', folderB);

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([]),
      existingAlbums: [],
      threshold: 0.75,
    };

    const result = mergeMany([payloadA, payloadB], ctx);

    // mergeMany возвращает результат для каждого payload: первый — created,
    // второй — merged-strict к первому
    expect(result.results).toHaveLength(2);
    expect(result.results[0]!.action).toBe('created');
    expect(result.results[1]!.action).toBe('merged-strict');
    expect(result.results[1]!.matchedTrackId).toBe(result.results[0]!.track.id);
    expect(result.results[1]!.track.sources).toHaveLength(2);
    const folderIds = result.results[1]!.track.sources.map((s) => (s.kind === 'local' ? s.folderId : ''));
    expect(folderIds).toEqual([folderA, folderB]);
  });

  it('ДОЛЖЕН склеить три payload с одинаковым artist/title в разных папках', () => {
    const folderA = newFolderId();
    const folderB = newFolderId();
    const folderC = newFolderId();

    const payloadA = makeIncomingPayload('Sabaton', 'The Attack of the Dead Men', 'track.mp3', folderA);
    const payloadB = makeIncomingPayload('Sabaton', 'The Attack of the Dead Men', 'track.mp3', folderB);
    const payloadC = makeIncomingPayload('Sabaton', 'The Attack of the Dead Men', 'track.mp3', folderC);

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([]),
      existingAlbums: [],
      threshold: 0.75,
    };

    const result = mergeMany([payloadA, payloadB, payloadC], ctx);

    // mergeMany возвращает результат для каждого payload, но все три должны
    // сослаться на один и тот же трек (второй и третий - merged-strict)
    expect(result.results).toHaveLength(3);
    expect(result.results[0]!.action).toBe('created');
    expect(result.results[1]!.action).toBe('merged-strict');
    expect(result.results[2]!.action).toBe('merged-strict');
    expect(result.results[1]!.matchedTrackId).toBe(result.results[0]!.track.id);
    expect(result.results[2]!.matchedTrackId).toBe(result.results[0]!.track.id);
    expect(result.results[2]!.track.sources).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// СЦЕНАРИЙ 2: merge — один и тот же artist/title, разный source
// ---------------------------------------------------------------------------

describe('merge: одинаковый artist/title, разный source', () => {
  it('ДОЛЖЕН склеить incoming с existing, если artist/title совпадают', () => {
    const folderA = newFolderId();
    const folderB = newFolderId();

    const existing = makeExistingTrack({
      artist: 'Light The Torch',
      title: 'More Than Dreaming',
      sources: [makeLocalSource('track.mp3', folderA)],
    });

    const incoming = makeIncomingPayload('Light The Torch', 'More Than Dreaming', 'track.mp3', folderB);

    const sourceIndex = new Map<string, Track>();
    sourceIndex.set(sourceKey(existing.sources[0]!), existing);

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([existing]),
      existingAlbums: [],
      threshold: 0.75,
      sourceIndex,
    };

    const result = merge(incoming, ctx);

    expect(result.action).toBe('merged-strict');
    expect(result.matchedTrackId).toBe(existing.id);
    expect(result.track.sources).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// СЦЕНАРИЙ 3: mergeMany — разные треки в разных папках (не склеивать)
// ---------------------------------------------------------------------------

describe('mergeMany: разные треки в разных папках', () => {
  it('НЕ ДОЛЖЕН склеивать разные треки', () => {
    const folderA = newFolderId();
    const folderB = newFolderId();

    const payloadA = makeIncomingPayload('Radiohead', 'Creep', 'track1.mp3', folderA);
    const payloadB = makeIncomingPayload('Portishead', 'Glory Box', 'track2.mp3', folderB);

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([]),
      existingAlbums: [],
      threshold: 0.75,
    };

    const result = mergeMany([payloadA, payloadB], ctx);

    expect(result.results).toHaveLength(2);
    expect(result.results.every((r) => r.action === 'created')).toBe(true);
  });
});
