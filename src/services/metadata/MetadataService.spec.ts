// src/services/metadata/MetadataService.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { metadataService } from './MetadataService';
import { useLibraryStore } from '@/stores/library';
import { resetProcessedTrack } from './AutoFetchRegistry';
import { newTrackId } from '@/types/ids';

// Мокаем resetProcessedTrack, чтобы проверить, что он вызывается
vi.mock('./AutoFetchRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./AutoFetchRegistry')>();
  return {
    ...actual,
    resetProcessedTrack: vi.fn(actual.resetProcessedTrack),
  };
});

describe('MetadataService.reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('сбрасывает hasMetadataEdits в false и вызывает resetProcessedTrack', async () => {
    const library = useLibraryStore();
    const trackId = newTrackId();

    // 1. Создаем трек с "измененными" метаданными
    library.tracks[trackId] = {
      id: trackId,
      pluginId: 'local',
      artist: 'Artist A',
      title: 'Mocked Title',
      albumId: null,
      coverUrl: null,
      sources: [],
      metadataCandidates: [],
      raw: {
        artist: 'Artist A',
        title: 'Track 1',
        album: '',
        coverUrl: null,
      },
      hasId3Tags: false,
      hasMetadataEdits: true,
      metaSource: 'auto',
    };

    // 2. Вызываем reset
    await metadataService.reset(trackId);

    // 3. Проверяем, что трек сбросился
    const updatedTrack = library.getTrack(trackId);
    expect(updatedTrack?.title).toBe('Track 1');
    expect(updatedTrack?.hasMetadataEdits).toBe(false);
    expect(updatedTrack?.metaSource).toBe('filename');

    // 4. Проверяем, что флаг автопоиска сброшен
    expect(resetProcessedTrack).toHaveBeenCalledWith(trackId);
  });
});
