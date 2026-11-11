// src/composables/useTrackFilter.spec.ts

import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useTrackFilter } from './useTrackFilter';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'yandex',
    artist: 'Artist',
    title: 'Song',
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

describe('useTrackFilter', () => {
  it('без preFilter возвращает исходные треки', () => {
    const tracks = ref([makeTrack(), makeTrack()]);
    const { preFilteredTracks } = useTrackFilter(tracks);
    expect(preFilteredTracks.value.length).toBe(2);
  });

  it('preFilter фильтрует треки', () => {
    const tracks = ref([makeTrack({ artist: 'A' }), makeTrack({ artist: 'B' })]);
    const { preFilteredTracks } = useTrackFilter(tracks, (t) => t.artist === 'A');
    expect(preFilteredTracks.value.length).toBe(1);
    expect(preFilteredTracks.value[0]!.artist).toBe('A');
  });

  it('filterOptions собирает уникальные pluginId', () => {
    const tracks = ref([
      makeTrack({ pluginId: 'yandex' }),
      makeTrack({ pluginId: 'local' }),
      makeTrack({ pluginId: 'yandex' }),
    ]);
    const { filterOptions } = useTrackFilter(tracks);
    const ids = filterOptions.value.map((o) => o.id);
    expect(ids).toContain('yandex');
    expect(ids).toContain('local');
    expect(ids.length).toBe(2);
  });

  it('sourceFilter = "yandex" фильтрует по плагину', () => {
    const tracks = ref([makeTrack({ pluginId: 'yandex:Music' }), makeTrack({ pluginId: 'local' })]);
    const { sourceFilter, filteredTracks } = useTrackFilter(tracks);
    expect(filteredTracks.value.length).toBe(2);
    sourceFilter.value = 'yandex';
    expect(filteredTracks.value.length).toBe(1);
    expect(filteredTracks.value[0]!.pluginId).toBe('yandex:Music');
  });

  it('sourceFilter = "all" возвращает все пресфильтрованные', () => {
    const tracks = ref([makeTrack({ pluginId: 'yandex:Music' }), makeTrack({ pluginId: 'local' })]);
    const { sourceFilter, filteredTracks } = useTrackFilter(tracks);
    sourceFilter.value = 'all';
    expect(filteredTracks.value.length).toBe(2);
  });
});
