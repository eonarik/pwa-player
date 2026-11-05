// src/services/library/TrackMerger/sourceKey.spec.ts

import { describe, it, expect } from 'vitest';
import { merge, sourceKey, type MergeContext } from './merge';
import { buildLibraryIndex } from './utils';
import type { Track } from '@/types/track';
import type { PluginTrackPayload } from '@/types/plugin';
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
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

function makeLocalSource(name: string, folderId = newFolderId()) {
  return {
    id: newTrackSourceId(),
    pluginId: 'local',
    priority: 10,
    kind: 'local' as const,
    handle: { name } as FileSystemFileHandle,
    folderId,
  };
}

function makeIncomingPayload(overrides: Partial<PluginTrackPayload> = {}): PluginTrackPayload {
  return {
    artist: 'Artist',
    title: 'Title',
    album: '',
    coverUrl: null,
    hasId3Tags: true,
    source: makeLocalSource('track.mp3'),
    ...overrides,
  };
}

describe('БАГ: sourceKey collision для local', () => {
  it('ДВА разных файла с одинаковым именем, но в разных папках — НЕ ДОЛЖНЫ склеиваться', () => {
    const folderA = newFolderId();
    const folderB = newFolderId();

    // Существующий трек: Folder A/track.mp3
    const existing = makeExistingTrack({
      artist: 'Artist A',
      title: 'Track A',
      sources: [makeLocalSource('track.mp3', folderA)],
    });
    const incoming = makeIncomingPayload({
      artist: 'Artist B',
      title: 'Track B',
      source: makeLocalSource('track.mp3', folderB),
    });

    // Индекс существующих треков
    const sourceIndex = new Map<string, Track>();
    for (const track of [existing]) {
      for (const src of track.sources) {
        sourceIndex.set(sourceKey(src), track);
      }
    }

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([existing]),
      existingAlbums: [],
      threshold: 0.75,
      sourceIndex,
    };

    const result = merge(incoming, ctx);

    // Ожидаем, что это НЕ merged-strict (не тот же файл).
    // Сейчас — strict, потому что sourceKey не учитывает folderId.
    expect(result.action).toBe('created');
    expect(result.matchedTrackId).toBeNull();
    expect(result.track.id).not.toBe(existing.id);
  });

  it('ОДИН И ТОТ ЖЕ файл (handle.name + folderId) — strict', () => {
    const folder = newFolderId();

    const existing = makeExistingTrack({
      sources: [makeLocalSource('track.mp3', folder)],
    });

    const incoming = makeIncomingPayload({
      source: makeLocalSource('track.mp3', folder),
    });

    const sourceIndex = new Map<string, Track>();
    for (const track of [existing]) {
      for (const src of track.sources) {
        sourceIndex.set(sourceKey(src), track);
      }
    }

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([existing]),
      existingAlbums: [],
      threshold: 0.75,
      sourceIndex,
    };

    const result = merge(incoming, ctx);

    expect(result.action).toBe('merged-strict');
    expect(result.matchedTrackId).toBe(existing.id);
  });

  it('local → cloud fallback по имени файла: ДОЛЖЕН найти cloud трек с тем же fileName', () => {
    const cloudFolder = newFolderId();
    const localFolder = newFolderId();

    // Существующий cloud трек (Yandex)
    const existing = makeExistingTrack({
      pluginId: 'yandex',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'yandex',
          priority: 20,
          kind: 'cloud',
          remotePath: '/Music/Album 1/track.mp3',
          folderId: cloudFolder,
        },
      ],
    });

    // Входящий local трек с тем же именем файла
    const incoming = makeIncomingPayload({
      source: makeLocalSource('track.mp3', localFolder),
    });

    const sourceIndex = new Map<string, Track>();
    for (const track of [existing]) {
      for (const src of track.sources) {
        sourceIndex.set(sourceKey(src), track);
      }
    }

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([existing]),
      existingAlbums: [],
      threshold: 0.75,
      sourceIndex,
    };

    const result = merge(incoming, ctx);

    // Ожидаем, что это strict (fallback по имени файла сработал)
    expect(result.action).toBe('merged-strict');
    expect(result.matchedTrackId).toBe(existing.id);
    expect(result.track.sources.length).toBe(2);
    expect(result.track.sources.some((s) => s.kind === 'cloud')).toBe(true);
    expect(result.track.sources.some((s) => s.kind === 'local')).toBe(true);
  });

  it('local → cloud fallback НЕ должен склеивать два разных cloud трека с одинаковым именем файла', () => {
    const cloudFolderA = newFolderId();
    const cloudFolderB = newFolderId();
    const localFolder = newFolderId();

    // Два cloud трека: Music/track.mp3 и Other/track.mp3
    const existingA = makeExistingTrack({
      artist: 'Artist A',
      title: 'Track A',
      pluginId: 'yandex',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'yandex',
          priority: 20,
          kind: 'cloud',
          remotePath: '/Music/track.mp3',
          folderId: cloudFolderA,
        },
      ],
    });
    const existingB = makeExistingTrack({
      artist: 'Artist B',
      title: 'Track B',
      pluginId: 'yandex',
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'yandex',
          priority: 20,
          kind: 'cloud',
          remotePath: '/Other/track.mp3',
          folderId: cloudFolderB,
        },
      ],
    });

    // Входящий local с тем же именем файла, но с folderId, соответствующим Music
    const incoming = makeIncomingPayload({
      artist: 'Artist C',
      title: 'Track C',
      source: makeLocalSource('track.mp3', localFolder),
    });

    const sourceIndex = new Map<string, Track>();
    for (const track of [existingA, existingB]) {
      for (const src of track.sources) {
        sourceIndex.set(sourceKey(src), track);
      }
    }

    const ctx: MergeContext = {
      libraryIndex: buildLibraryIndex([existingA, existingB]),
      existingAlbums: [],
      threshold: 0.75,
      sourceIndex,
    };

    const result = merge(incoming, ctx);

    // Ожидаем, что НЕ склеится (неоднозначность: два cloud трека с одним именем).
    // Пользователь должен явно выбрать через кандидата.
    // Сейчас — strict к первому найденному, что неверно.
    expect(result.action).toBe('created');
  });
});
