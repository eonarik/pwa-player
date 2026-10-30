// src/services/playlists/PlaylistMatcher.spec.ts

import { describe, it, expect } from 'vitest';
import { findBestMatch } from './PlaylistMatcher';
import type { Track } from '@/types/track';
import { newTrackId } from '@/types/ids';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'Artist A',
    title: 'Track 1',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: true,
    ...overrides,
  };
}

describe('PlaylistMatcher', () => {
  describe('Строгое совпадение', () => {
    it('ДОЛЖЕН возвращать 1.0 для идентичных треков', () => {
      const incoming = makeTrack({ artist: 'Radiohead', title: 'Creep' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Creep' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('ДОЛЖЕН игнорировать регистр и пробелы', () => {
      const incoming = makeTrack({ artist: '  radiohead  ', title: ' CREEP ' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Creep' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });
  });

  describe('Fuzzy-совпадение (опечатки)', () => {
    it('ДОЛЖЕН склеивать "Karma Police" и "Karma Polise"', () => {
      const incoming = makeTrack({ artist: 'Radiohead', title: 'Karma Polise' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Karma Police' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBeGreaterThan(0.9);
    });

    it('НЕ ДОЛЖЕН склеивать разные треки одного артиста ("Track 1" vs "Track 2")', () => {
      const incoming = makeTrack({ artist: 'Artist A', title: 'Track 2' });
      const library = [makeTrack({ artist: 'Artist A', title: 'Track 1' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).toBeNull();
      expect(result.score).toBeLessThan(0.75);
    });

    it('НЕ ДОЛЖЕН склеивать ремастеры ("Song" vs "Song (Remaster)")', () => {
      const incoming = makeTrack({ artist: 'The Beatles', title: 'Song (Remaster)' });
      const library = [makeTrack({ artist: 'The Beatles', title: 'Song' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).toBeNull();
      expect(result.score).toBeLessThan(0.75);
    });
  });

  describe('Разные треки', () => {
    it('НЕ ДОЛЖЕН склеивать разных артистов', () => {
      const incoming = makeTrack({ artist: 'Portishead', title: 'Glory Box' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Creep' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).toBeNull();
    });

    it('НЕ ДОЛЖЕН склеивать коротких/цифровых артистов ("01" vs "02")', () => {
      const incoming = makeTrack({ artist: '02', title: 'Track 2' });
      const library = [makeTrack({ artist: '01', title: 'Track 1' })];

      const result = findBestMatch(incoming, library, 0.75);
      expect(result.track).toBeNull();
    });
  });
});
