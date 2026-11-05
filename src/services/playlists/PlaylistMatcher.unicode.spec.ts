// src/services/playlists/PlaylistMatcher.unicode.spec.ts

import { describe, it, expect } from 'vitest';
import { findBestMatch, normalizeMatchString } from './PlaylistMatcher';
import { buildLibraryIndex } from '@/services/library/TrackMerger';
import type { Track } from '@/types/track';
import { newTrackId } from '@/types/ids';

function makeTrack(overrides: Partial<Track> = {}): Track {
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

describe('PlaylistMatcher: Unicode и диакритика', () => {
  describe('NFC vs NFD (одна кодовая точка vs комбинируемая)', () => {
    it('"й" в NFC и NFD — strict match (это одна буква)', () => {
      const nfc = '\u0439'; // й (NFC)
      const nfd = 'и\u0306'; // й (NFD: и + combining breve)

      const incoming = makeTrack({ artist: 'Artist', title: `Трек ${nfc}` });
      const library = [makeTrack({ artist: 'Artist', title: `Трек ${nfd}` })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });
  });

  describe('Диакритика схлопывается (ё → е, é → e, ä → a, ...)', () => {
    it('"ё" и "е" — strict match', () => {
      const incoming = makeTrack({ artist: 'Ёлка', title: 'Песня' });
      const library = [makeTrack({ artist: 'Елка', title: 'Песня' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('"Beyoncé" и "Beyonce" — strict match', () => {
      const incoming = makeTrack({ artist: 'Beyoncé', title: 'Halo' });
      const library = [makeTrack({ artist: 'Beyonce', title: 'Halo' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('"Café" и "Cafe" — strict match', () => {
      const incoming = makeTrack({ artist: 'Café', title: 'Song' });
      const library = [makeTrack({ artist: 'Cafe', title: 'Song' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('"Mädchen" и "Madchen" — strict match (немецкий умлаут)', () => {
      const incoming = makeTrack({ artist: 'Rammstein', title: 'Mädchen' });
      const library = [makeTrack({ artist: 'Rammstein', title: 'Madchen' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('"Straße" и "Strasse" — strict match (ß → ss)', () => {
      const incoming = makeTrack({ artist: 'Artist', title: 'Straße' });
      const library = [makeTrack({ artist: 'Artist', title: 'Strasse' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });
  });

  describe('"й" НЕ схлопывается в "и" (разные буквы)', () => {
    it('"мой" и "мои" — не strict', () => {
      const incoming = makeTrack({ artist: 'Artist', title: 'Мой трек' });
      const library = [makeTrack({ artist: 'Artist', title: 'Мои трек' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
    });
  });

  describe('normalizeMatchString: базовая нормализация', () => {
    it('NFC: "й" NFD превращается в NFC', () => {
      const nfd = 'и\u0306';
      expect(normalizeMatchString(nfd)).toBe('\u0439');
    });

    it('trim + lowercase + collapse spaces', () => {
      expect(normalizeMatchString('  Hello   World  ')).toBe('hello world');
    });

    it('диакритика схлопывается', () => {
      expect(normalizeMatchString('Beyoncé')).toBe('beyonce');
      expect(normalizeMatchString('Ёлка')).toBe('елка');
      expect(normalizeMatchString('Mädchen')).toBe('madchen');
      expect(normalizeMatchString('Straße')).toBe('strasse');
    });

    it('"й" не схлопывается', () => {
      expect(normalizeMatchString('мой')).toBe('мой');
      expect(normalizeMatchString('йод')).toBe('йод');
    });

    it('кириллица (кроме ё) не трогается', () => {
      expect(normalizeMatchString('Привет')).toBe('привет');
    });
  });
});
