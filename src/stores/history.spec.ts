// src/stores/history.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHistoryStore } from './history';
import { useLibraryStore } from './library';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import * as TrackMerger from '@/services/library/TrackMerger';
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
    artist: 'Artist A',
    title: 'Track 1',
    albumId: null,
    coverUrl: null,
    sources: [
      {
        id: newTrackSourceId(),
        pluginId: 'local',
        priority: 10,
        kind: 'local',
        handle: {} as FileSystemFileHandle,
        folderId: newFolderId(),
      },
    ],
    metadataCandidates: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

describe('history.recordPlay: оптимизация', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('для трека, который уже в библиотеке (strict), не вызывает merge/apply', async () => {
    const library = useLibraryStore();
    const history = useHistoryStore();

    const track = makeTrack();
    library.tracks[track.id] = track;

    const mergeSpy = vi.spyOn(TrackMerger, 'merge');
    const applySpy = vi.spyOn(TrackMerger, 'apply');

    await history.recordPlay(track);

    expect(mergeSpy).not.toHaveBeenCalled();
    expect(applySpy).not.toHaveBeenCalled();
    expect(history.history.playedAt[track.id]).toBeGreaterThan(0);
  });

  it('для трека, которого нет в библиотеке, вызывает merge/apply', async () => {
    const history = useHistoryStore();

    const track = makeTrack();

    const mergeSpy = vi.spyOn(TrackMerger, 'merge');
    const applySpy = vi.spyOn(TrackMerger, 'apply');

    await history.recordPlay(track);

    expect(mergeSpy).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalled();
  });

  it('для трека в библиотеке с расходящимися artist/title, вызывает merge/apply (merged-soft)', async () => {
    const library = useLibraryStore();
    const history = useHistoryStore();

    const existing = makeTrack({ artist: 'Artist A', title: 'Track 1' });
    library.tracks[existing.id] = existing;

    // Тот же id, но другой title — симулирует обновление метаданных в очереди
    const incoming = { ...existing, title: 'Track 1 (Remaster)' };

    const mergeSpy = vi.spyOn(TrackMerger, 'merge');

    await history.recordPlay(incoming);

    expect(mergeSpy).toHaveBeenCalled();
  });
});
