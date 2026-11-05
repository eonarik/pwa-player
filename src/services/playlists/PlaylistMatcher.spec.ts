// src/services/playlists/PlaylistMatcher.spec.ts

import { describe, it, expect } from 'vitest';
import { findBestMatch } from './PlaylistMatcher';
import type { Track } from '@/types/track';
import { newTrackId } from '@/types/ids';
import { buildLibraryIndex } from '@/services/library/TrackMerger';

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

describe('PlaylistMatcher (Строгие правила)', () => {
  describe('1. Полное совпадение (merged-strict)', () => {
    it('ДОЛЖЕН возвращать 1.0 для идентичных треков', () => {
      const incoming = makeTrack({ artist: 'Radiohead', title: 'Creep' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Creep' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('ДОЛЖЕН игнорировать регистр, лишние пробелы и Unicode-формы', () => {
      const incoming = makeTrack({ artist: '  radiohead  ', title: '  CREEP  ' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Creep' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });

    it('ДОЛЖЕН приводить к одной форме "й" (NFC vs NFD)', () => {
      // "й" может быть одной кодовой точкой (NFC) или "и" + комбинируемый бревис (NFD).
      const nfc = '\u0439'; // й (NFC)
      const nfd = 'и\u0306'; // й (NFD)
      const incoming = makeTrack({ artist: 'Artist', title: `Трек ${nfc}` });
      const library = [makeTrack({ artist: 'Artist', title: `Трек ${nfd}` })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(1.0);
    });
  });

  describe('2. Частичное совпадение тайтла (кандидат, score 0.9)', () => {
    it('ДОЛЖЕН находить, если title1 — подстрока title2', () => {
      const incoming = makeTrack({ artist: 'Light The Torch', title: 'More Than Dreaming' });
      const library = [makeTrack({ artist: 'Light The Torch', title: 'More Than Dreaming (OFFICIAL VIDEO)' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(0.9);
    });

    it('ДОЛЖЕН находить, если title2 — подстрока title1', () => {
      const incoming = makeTrack({ artist: 'Sabaton', title: 'The Attack of the Dead Men (Lyric Video)' });
      const library = [makeTrack({ artist: 'Sabaton', title: 'The Attack of the Dead Men' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).not.toBeNull();
      expect(result.score).toBe(0.9);
    });
  });

  describe('3. Разные тайтлы (новый трек)', () => {
    it('НЕ ДОЛЖЕН склеивать "Психея - Снег" и "Психея - Навсегда"', () => {
      const incoming = makeTrack({ artist: 'Психея', title: 'Снег' });
      const library = [makeTrack({ artist: 'Психея', title: 'Навсегда' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
      expect(result.score).toBe(0);
    });

    it('НЕ ДОЛЖЕН склеивать "Muse - Sunburn" и "Muse - New Born"', () => {
      const incoming = makeTrack({ artist: 'Muse', title: 'Sunburn' });
      const library = [makeTrack({ artist: 'Muse', title: 'New Born' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
      expect(result.score).toBe(0);
    });
  });

  describe('4. Разные артисты (новый трек)', () => {
    it('НЕ ДОЛЖЕН склеивать разных артистов, даже с одинаковым тайтлом', () => {
      const incoming = makeTrack({ artist: 'Portishead', title: 'Glory Box' });
      const library = [makeTrack({ artist: 'Radiohead', title: 'Glory Box' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
    });

    it('НЕ ДОЛЖЕН склеивать "30 Seconds to Mars" и "Thirty Seconds to Mars"', () => {
      // По правилам: полное совпадение или никакого. Алиасы — на бэкенде.
      const incoming = makeTrack({ artist: 'Thirty Seconds to Mars', title: 'The Kill' });
      const library = [makeTrack({ artist: '30 Seconds to Mars', title: 'The Kill' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
    });
  });

  describe('5. Пустой артист (скипаем мерж)', () => {
    it('НЕ ДОЛЖЕН склеивать треки без артиста, даже если title совпадает', () => {
      const incoming = makeTrack({ artist: '', title: 'Track 1' });
      const library = [makeTrack({ artist: '', title: 'Track 1' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
    });

    it('НЕ ДОЛЖЕН склеивать, если у одного артист пустой, а у другого нет', () => {
      const incoming = makeTrack({ artist: '', title: 'Track 1' });
      const library = [makeTrack({ artist: 'Artist A', title: 'Track 1' })];

      const result = findBestMatch(incoming, buildLibraryIndex(library), 0.75);
      expect(result.track).toBeNull();
    });
  });
});
