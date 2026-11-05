// src/services/library/TrackMerger/utils.spec.ts

import { describe, it, expect } from 'vitest';
import { isStrictMatch, buildLibraryIndex } from './utils';
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

describe('TrackMerger/utils: isStrictMatch', () => {
  it('true для идентичных (после нормализации)', () => {
    const a = makeTrack({ artist: 'Radiohead', title: 'Creep' });
    const b = makeTrack({ artist: '  radiohead  ', title: '  CREEP ' });
    expect(isStrictMatch(a, b)).toBe(true);
  });

  it('false для разных artist', () => {
    const a = makeTrack({ artist: 'Portishead', title: 'Glory Box' });
    const b = makeTrack({ artist: 'Radiohead', title: 'Glory Box' });
    expect(isStrictMatch(a, b)).toBe(false);
  });

  it('false для разных title', () => {
    const a = makeTrack({ artist: 'Психея', title: 'Снег' });
    const b = makeTrack({ artist: 'Психея', title: 'Навсегда' });
    expect(isStrictMatch(a, b)).toBe(false);
  });

  it('false для title с суффиксом (это soft, не strict)', () => {
    const a = makeTrack({ artist: 'Sabaton', title: 'The Attack of the Dead Men' });
    const b = makeTrack({ artist: 'Sabaton', title: 'The Attack of the Dead Men (Official Video)' });
    expect(isStrictMatch(a, b)).toBe(false);
  });
});

describe('TrackMerger/utils: buildLibraryIndex', () => {
  it('индексирует по нормализованному artist (lowercase + trim + collapse spaces)', () => {
    const track = makeTrack({ artist: '  Психея  ', title: 'Снег' });
    const index = buildLibraryIndex([track]);
    expect(index.has('психея')).toBe(true);
    expect(index.get('психея')).toHaveLength(1);
  });

  it('схлопывает множественные пробелы', () => {
    const track = makeTrack({ artist: 'The   Beatles', title: 'Let It Be' });
    const index = buildLibraryIndex([track]);
    expect(index.has('the beatles')).toBe(true);
  });

  it('приводит Unicode к NFC (NFD "й" == NFC "й")', () => {
    const nfc = '\u0439';
    const nfd = 'и\u0306';
    const track = makeTrack({ artist: `Artist ${nfd}`, title: 'T' });
    const index = buildLibraryIndex([track]);
    expect(index.has(`artist ${nfc}`.toLowerCase())).toBe(true);
  });

  it('несколько треков с одним artist попадают в один массив', () => {
    const t1 = makeTrack({ artist: 'Radiohead', title: 'Creep' });
    const t2 = makeTrack({ artist: 'radiohead', title: 'Karma Police' });
    const index = buildLibraryIndex([t1, t2]);
    expect(index.get('radiohead')).toHaveLength(2);
  });
});
