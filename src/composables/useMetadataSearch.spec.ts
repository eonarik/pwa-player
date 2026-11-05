// src/composables/useMetadataSearch.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref } from 'vue';
import { useMetadataSearch } from './useMetadataSearch';
import { useLibraryStore } from '@/stores/library';
import { metadataService } from '@/services/metadata/MetadataService';
import { toastService } from '@/services/ui/ToastService';
import { modalService } from '@/services/ui/ModalService';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';

vi.mock('@/plugins/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/plugins/registry')>();
  return {
    ...actual,
    loadPlugin: vi.fn().mockResolvedValue({ saveCache: vi.fn() }),
  };
});

vi.mock('@/components/library/MetadataCandidatesModal.vue', () => ({
  default: { name: 'MetadataCandidatesModal' },
}));

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

describe('useMetadataSearch: issues + toast action', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('после search() с candidates показывает тост с action «Открыть»', async () => {
    const library = useLibraryStore();
    const track = makeTrack();
    library.tracks[track.id] = track;

    vi.spyOn(metadataService, 'fetchAndApply').mockResolvedValue({ status: 'candidates' });
    vi.spyOn(metadataService, 'getEntry').mockReturnValue(undefined);
    vi.spyOn(metadataService, 'flush').mockResolvedValue(undefined);
    const toastSpy = vi.spyOn(toastService, 'showPersistent');
    const modalSpy = vi.spyOn(modalService, 'show');

    const { search, issues } = useMetadataSearch(ref([track]));
    await search();

    expect(issues.value.length).toBe(1);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith(
      'Найдено кандидатов: 1',
      'info',
      expect.objectContaining({ label: 'Открыть' }),
    );

    // Проверяем, что нажатие action открывает модалку
    const action = toastSpy.mock.calls[0]![2]!;
    action.onAction();
    expect(modalSpy).toHaveBeenCalledTimes(1);
  });
});
