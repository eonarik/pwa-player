// src/components/library/metadata/useMetadataCandidates.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type { MetadataCandidate } from '@/types/metadata';
import type { Track } from '@/types/track';
import { newTrackId } from '@/types/ids';
import { useMetadataCandidates } from './useMetadataCandidates';

const h = vi.hoisted(() => ({
  fetchCandidates: vi.fn(async (): Promise<MetadataCandidate[]> => []),
}));

vi.mock('@/services/metadata/MetadataService', () => ({
  metadataService: { fetchCandidates: h.fetchCandidates },
}));

function trackStub(title = 'Song'): Track {
  return {
    id: newTrackId(),
    pluginId: 'yandexDisk',
    artist: 'Artist',
    title,
    albumId: null,
    coverUrl: null,
    sources: [],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
  };
}

describe('useMetadataCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.fetchCandidates.mockImplementation(async () => []);
  });

  it('загрузка кандидатов через сервис', async () => {
    const t = trackStub();
    const c = [
      { id: 'c1' as never, artist: 'A', title: 'B', album: '', coverUrl: null, similarity: 0.9, provider: 'iTunes' },
    ];
    h.fetchCandidates.mockImplementation(async () => c);

    const { isLoading, load } = useMetadataCandidates(ref(t));
    await load();

    expect(isLoading.value).toBe(false);
    expect(h.fetchCandidates).toHaveBeenCalledWith(t.id);
  });

  it('без title — загрузка не запускается', async () => {
    const { load } = useMetadataCandidates(ref({ ...trackStub(), title: '' }));
    await load();
    expect(h.fetchCandidates).not.toHaveBeenCalled();
  });

  it('ошибка загрузки — список пустой, флаг сброшен', async () => {
    h.fetchCandidates.mockImplementation(async () => {
      throw new Error('net');
    });
    const { candidates, isLoading, load } = useMetadataCandidates(ref(trackStub()));
    await load();
    expect(isLoading.value).toBe(false);
    expect(candidates.value).toEqual([]);
  });

  it('select — возвращает кандидата и ставит индекс', async () => {
    const t = trackStub();
    const c = [{ id: 'c1' as never, artist: 'A', title: 'B', album: '', coverUrl: null, similarity: 0.9, provider: 'iTunes' }];
    h.fetchCandidates.mockImplementation(async () => c);

    const { selectedIndex, load, select } = useMetadataCandidates(ref(t));
    await load();

    const picked = select(0);
    expect(picked).toBeTruthy();
    expect(selectedIndex.value).toBe(0);

    expect(select(99)).toBeNull();
  });
});
