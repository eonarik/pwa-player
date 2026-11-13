// src/stores/player/actions/helpers.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';

const h = vi.hoisted(() => ({
  isDownloading: vi.fn(() => false),
}));

vi.mock('@/services/download/DownloadOrchestrator', () => ({
  downloadOrchestrator: { isDownloading: h.isDownloading },
}));

import { createHelpers } from './helpers';

function makeTrack(sources: Track['sources']): Track {
  return {
    id: newTrackId(),
    pluginId: sources[0]?.pluginId ?? 'local',
    artist: 'A',
    title: 'T',
    albumId: null,
    coverUrl: null,
    sources,
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
  };
}

describe('shouldSkipAuto (BUG-013)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    h.isDownloading.mockReturnValue(false);
  });

  it('скипает трек, который сейчас скачивается', () => {
    const track = makeTrack([
      {
        id: newTrackSourceId(),
        pluginId: 'yandexDisk:1',
        priority: 5,
        kind: 'cloud',
        remotePath: '/a.mp3',
        folderId: newFolderId(),
      },
    ]);

    h.isDownloading.mockReturnValue(true);

    const { shouldSkipAuto } = createHelpers();

    // До фикса здесь был литерал isDownloading: false — скачивающийся трек
    // не скипался и playAt тратил попытку resolveTrackSource на него.
    expect(shouldSkipAuto(track)).toBe(true);
    expect(h.isDownloading).toHaveBeenCalledWith(track.id);
  });

  it('не скипает обычный cloud-трек без качания', () => {
    const track = makeTrack([
      {
        id: newTrackSourceId(),
        pluginId: 'yandexDisk:1',
        priority: 5,
        kind: 'cloud',
        remotePath: '/a.mp3',
        folderId: newFolderId(),
      },
    ]);

    const { shouldSkipAuto } = createHelpers();

    expect(shouldSkipAuto(track)).toBe(false);
  });

  it('скипает трек без источников', () => {
    const track = makeTrack([]);
    const { shouldSkipAuto } = createHelpers();
    expect(shouldSkipAuto(track)).toBe(true);
  });
});
