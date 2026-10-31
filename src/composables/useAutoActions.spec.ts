// src/composables/useAutoActions.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAutoActions } from './useAutoActions';
import { usePlayerStore } from '@/stores/player';
import { useLibraryStore } from '@/stores/library';
import { runAutoFetch } from '@/services/metadata/runAutoFetch';
import { newTrackId } from '@/types/ids';
import { isProcessed } from '@/services/metadata/AutoFetchRegistry';
import { withSetup } from '@/test/withSetup';

// Мокаем runAutoFetch
vi.mock('@/services/metadata/runAutoFetch', () => ({
  runAutoFetch: vi.fn(),
}));

describe('useAutoActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('вызывает runAutoFetch при увеличении playbackVersion, если hasMetadataEdits = false', async () => {
    const library = useLibraryStore();
    const player = usePlayerStore();
    const trackId = newTrackId();

    // 1. Создаем трек
    library.tracks[trackId] = {
      id: trackId,
      pluginId: 'local',
      artist: 'Artist A',
      title: 'Track 1',
      albumId: null,
      coverUrl: null,
      sources: [],
      metadataCandidates: [],
      raw: null,
      hasId3Tags: false,
      hasMetadataEdits: false,
    };

    // 2. Монтируем composable
    withSetup(() => useAutoActions());

    // 3. Имитируем клик на трек (устанавливаем currentTrack и увеличиваем версию)
    player.currentTrack = library.tracks[trackId]!;
    player.playbackVersion++;

    // 4. Ждем, пока отработают все промисы
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 5. Проверяем, что автопоиск запустился
    expect(isProcessed(trackId)).toBe(true);
    expect(runAutoFetch).toHaveBeenCalledWith(library.tracks[trackId]);
  });

  it('НЕ вызывает runAutoFetch, если hasMetadataEdits = true', async () => {
    const library = useLibraryStore();
    const player = usePlayerStore();
    const trackId = newTrackId();

    library.tracks[trackId] = {
      id: trackId,
      pluginId: 'local',
      artist: 'Artist A',
      title: 'Track 1',
      albumId: null,
      coverUrl: null,
      sources: [],
      metadataCandidates: [],
      raw: null,
      hasId3Tags: false,
      hasMetadataEdits: true,
    };

    withSetup(() => useAutoActions());

    player.currentTrack = library.tracks[trackId]!;
    player.playbackVersion++;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runAutoFetch).not.toHaveBeenCalled();
  });
});
