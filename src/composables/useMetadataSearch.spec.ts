// src/composables/useMetadataSearch.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useMetadataSearch } from './useMetadataSearch';
import { useLibraryStore } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import { toastService } from '@/services/ui/ToastService';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';

vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return {
    ...actual,
    loadPlugin: vi.fn().mockResolvedValue({ saveCache: vi.fn() }),
  };
});

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
    hasId3Tags: false,
    ...overrides,
  };
}

describe('useMetadataSearch: issues', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('показывает тост с количеством найденных кандидатов', async () => {
    const library = useLibraryStore();
    const track = makeTrack();
    library.tracks[track.id] = track;

    // Мокаем fetchAndApply, чтобы вернуть 'candidates'
    const fetchSpy = vi.spyOn(metadataService, 'fetchAndApply').mockResolvedValue({ status: 'candidates' });
    const toastSpy = vi.spyOn(toastService, 'info');

    // Мокаем getEntry, чтобы uncheckedTracks не фильтровал трек
    vi.spyOn(metadataService, 'getEntry').mockReturnValue(undefined);
    vi.spyOn(metadataService, 'flush').mockResolvedValue(undefined);

    const { search, issues } = useMetadataSearch(ref([track]));
    await search();

    expect(fetchSpy).toHaveBeenCalled();
    expect(issues.value.length).toBe(1);
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('Найдено кандидатов: 1'));
  });
});
