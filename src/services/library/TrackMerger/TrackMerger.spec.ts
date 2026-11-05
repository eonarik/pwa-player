// src/services/library/TrackMerger/TrackMerger.spec.ts

import { describe, it, expect } from 'vitest';
import { merge, buildLibraryIndex, type MergeContext } from './index';
import type { Track } from '@/types/track';
import type { PluginTrackPayload } from '@/types/plugin';
import { newTrackId, newTrackSourceId } from '@/types/ids';

function makeExistingTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist A',
    title: 'Track 1',
    albumId: null,
    coverUrl: null,
    sources: [
      {
        id: newTrackSourceId(),
        pluginId: 'local',
        priority: 10,
        kind: 'local',
        handle: { name: 'track1.mp3' } as FileSystemFileHandle,
        folderId: 'folder1' as any,
      },
    ],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

function makeIncomingPayload(overrides: Partial<PluginTrackPayload> = {}): PluginTrackPayload {
  return {
    artist: 'Artist A',
    title: 'Track 2',
    album: '',
    coverUrl: null,
    hasId3Tags: true,
    source: {
      pluginId: 'local',
      priority: 10,
      kind: 'local',
      handle: { name: 'track2.mp3' } as FileSystemFileHandle,
      folderId: 'folder1' as any,
    },
    ...overrides,
  };
}

describe('TrackMerger', () => {
  describe('Создание нового трека (created)', () => {
    it('НЕ должен склеивать сильно разные треки (разные артисты)', () => {
      const existing = makeExistingTrack({ artist: 'Portishead', title: 'Glory Box' });
      const incoming = makeIncomingPayload({ artist: 'Radiohead', title: 'Creep' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      expect(result.action).toBe('created');
      expect(result.matchedTrackId).toBeNull();
      expect(result.track.title).toBe('Creep');
      expect(result.track.sources).toHaveLength(1);
    });

    it('НЕ должен склеивать "Song" и "Song (Remaster)" как strict (но отправит в candidates)', () => {
      const existing = makeExistingTrack({ artist: 'The Beatles', title: 'Song' });
      const incoming = makeIncomingPayload({ artist: 'The Beatles', title: 'Song (Remaster)' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      // Разные title → strict не срабатывает. Score проходит — candidate.
      expect(result.action).toBe('merged-soft');
      expect(result.matchedTrackId).toBe(existing.id);
      expect(result.track.metadataCandidates).toHaveLength(1);
    });
  });

  describe('Строгий мёрж (merged-strict)', () => {
    it('ДОЛЖЕН склеивать идентичные треки и добавлять source', () => {
      const existing = makeExistingTrack({ artist: 'Radiohead', title: 'Creep' });
      const incoming = makeIncomingPayload({ artist: 'Radiohead', title: 'Creep' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      expect(result.action).toBe('merged-strict');
      expect(result.matchedTrackId).toBe(existing.id);
      expect(result.track.sources).toHaveLength(2);
    });

    it('НЕ ДОЛЖЕН добавлять дубликат source', () => {
      const existing = makeExistingTrack({ artist: 'Radiohead', title: 'Creep' });
      const incoming = makeIncomingPayload({
        artist: 'Radiohead',
        title: 'Creep',
        source: existing.sources[0] as any,
      });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      expect(result.action).toBe('merged-strict');
      expect(result.track.sources).toHaveLength(1);
    });
  });

  describe('Мягкий мёрж (merged-soft)', () => {
    it('НЕ ДОЛЖЕН отправлять "Karma Polise" в metadataCandidates', () => {
      const existing = makeExistingTrack({ artist: 'Radiohead', title: 'Karma Police' });
      const incoming = makeIncomingPayload({ artist: 'Radiohead', title: 'Karma Polise' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      // Опечатка — это новый трек по строгим правилам
      expect(result.action).toBe('created');
      expect(result.matchedTrackId).toBeNull();
    });

    it('НЕ ДОЛЖЕН отправлять "Track 2" в metadataCandidates (разные тайтлы)', () => {
      const existing = makeExistingTrack({ artist: 'Artist A', title: 'Track 1' });
      const incoming = makeIncomingPayload({ artist: 'Artist A', title: 'Track 2' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      expect(result.action).toBe('created');
      expect(result.matchedTrackId).toBeNull();
    });

    it('ДОЛЖЕН отправлять "Song" в metadataCandidates, если это "Song (Remaster)" (подстрока)', () => {
      const existing = makeExistingTrack({ artist: 'The Beatles', title: 'Song' });
      const incoming = makeIncomingPayload({ artist: 'The Beatles', title: 'Song (Remaster)' });

      const ctx: MergeContext = {
        libraryIndex: buildLibraryIndex([existing]),
        existingAlbums: [],
        threshold: 0.75,
      };
      const result = merge(incoming, ctx);

      // "song" — подстрока "song (remaster)" → кандидат
      expect(result.action).toBe('merged-soft');
      expect(result.matchedTrackId).toBe(existing.id);
      expect(result.track.metadataCandidates).toHaveLength(1);
    });
  });
});
