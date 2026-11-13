// src/stores/player/actions/navigation.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref, shallowRef } from 'vue';
import type { PlayerActionsRefs } from './types';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import { AuthError } from '@/services/api/errors';

const h = vi.hoisted(() => ({
  resolveTrackSource: vi.fn(),
  load: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  toastError: vi.fn(),
  handleAuthError: vi.fn(),
  skipToNextOnError: vi.fn(),
}));

vi.mock('@/services/audio/resolveTrackSource', () => ({
  resolveTrackSource: h.resolveTrackSource,
}));

vi.mock('@/services/audio/AudioService', () => ({
  audioService: {
    load: h.load,
    play: h.play,
    pause: h.pause,
  },
}));

vi.mock('@/services/ui/ToastService', () => ({
  toastService: { error: h.toastError },
}));

vi.mock('@/services/metadata/MetadataService', () => ({
  metadataService: { fetchAndApply: vi.fn().mockResolvedValue({ status: 'skipped' }) },
}));

vi.mock('@/stores/library', () => ({
  useLibraryStore: () => ({ getTrack: () => null }),
}));

import { createNavigation } from './navigation';
import type { Helpers } from './helpers';
import type { Errors } from './errors';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'A',
    title: 'T',
    albumId: null,
    coverUrl: null,
    sources: [
      {
        id: newTrackSourceId(),
        pluginId: 'local:1',
        priority: 10,
        kind: 'local',
        handle: {} as FileSystemFileHandle,
        folderId: newFolderId(),
      },
    ],
    metadataCandidates: [],
    duplicateTrackIds: [],
    raw: null,
    hasId3Tags: false,
    ...overrides,
  };
}

function makeRefs(tracks: Track[]): PlayerActionsRefs {
  return {
    queue: ref(tracks),
    originalQueue: ref([...tracks]),
    currentIndex: ref(-1),
    currentTrack: shallowRef(null),
    isPlaying: ref(false),
    duration: ref(0),
    currentTime: ref(0),
    repeatMode: ref('off'),
    shuffle: ref(false),
    playbackVersion: ref(0),
  };
}

const helpersStub = { shouldSkipAuto: () => false, isAnyPluginDisconnected: () => false } as unknown as Helpers;
const errorsStub = {
  handleAuthError: h.handleAuthError,
  skipToNextOnError: h.skipToNextOnError,
} as unknown as Errors;

describe('playAt: перебор источников', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.play.mockResolvedValue(undefined);
    h.resolveTrackSource.mockResolvedValue('/file.mp3');
  });

  it('BUG-015: при AuthError пробует следующий источник, а не выходит из цикла', async () => {
    const cloud = makeTrack();
    const track = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'yandexDisk:1',
          priority: 5,
          kind: 'cloud',
          remotePath: '/a.mp3',
          folderId: newFolderId(),
        },
        {
          id: newTrackSourceId(),
          pluginId: 'zvuk:1',
          priority: 20,
          kind: 'streaming',
          url: 'https://stream/zvuk.mp3',
        },
      ],
    });

    h.resolveTrackSource.mockImplementation((_t: Track, s: { kind: string; url?: string }) => {
      if (s.kind === 'cloud') {
        return Promise.reject(new AuthError({ providerId: 'yandexDisk', reason: 'refresh-expired' }));
      }
      return Promise.resolve(s.url ?? '');
    });

    const refs = makeRefs([cloud, track]);
    const nav = createNavigation(refs, helpersStub, errorsStub);

    await nav.playAt(1);

    // Второй источник резолвился и заиграл.
    expect(h.resolveTrackSource).toHaveBeenCalledTimes(2);
    expect(h.load).toHaveBeenCalledTimes(1);
    expect(h.play).toHaveBeenCalledTimes(1);
    // Тост «все источники недоступны» не показан, скипа не было.
    expect(h.toastError).not.toHaveBeenCalled();
    expect(h.skipToNextOnError).not.toHaveBeenCalled();
    // AuthError обработан с id именно упавшего источника (для BUG-019).
    expect(h.handleAuthError).toHaveBeenCalledTimes(1);
    expect(h.handleAuthError.mock.calls[0]?.[2]).toBe(track.sources[0]!.id);
  });

  it('BUG-015: если после AuthError живых источников нет — тоста и скипа нет (решение у tosta «Подключить?»)', async () => {
    const authErr = new AuthError({ providerId: 'yandexDisk', reason: 'no-refresh-token' });
    h.resolveTrackSource.mockRejectedValue(authErr);

    const refs = makeRefs([makeTrack()]);
    const nav = createNavigation(refs, helpersStub, errorsStub);

    await nav.playAt(0);

    expect(h.handleAuthError).toHaveBeenCalledTimes(1);
    expect(h.toastError).not.toHaveBeenCalled();
    expect(h.skipToNextOnError).not.toHaveBeenCalled();
  });

  it('обычная ошибка источника: следующий источник пробуется, при всех мёртвых — тост + skip', async () => {
    h.resolveTrackSource.mockRejectedValue(new Error('404'));

    const refs = makeRefs([makeTrack(), makeTrack()]);
    const nav = createNavigation(refs, helpersStub, errorsStub);

    await nav.playAt(0);

    expect(h.handleAuthError).not.toHaveBeenCalled();
    expect(h.toastError).toHaveBeenCalled();
    expect(h.skipToNextOnError).toHaveBeenCalled();
  });

  it('источники сортируются по priority (низкий раньше)', async () => {
    const track = makeTrack({
      sources: [
        {
          id: newTrackSourceId(),
          pluginId: 'zvuk:2',
          priority: 90,
          kind: 'streaming',
          url: 'u-high',
        },
        {
          id: newTrackSourceId(),
          pluginId: 'local:1',
          priority: 10,
          kind: 'local',
          handle: {} as FileSystemFileHandle,
          folderId: newFolderId(),
        },
      ],
    });
    h.resolveTrackSource.mockImplementation((_t: Track, s: { url?: string }) =>
      Promise.resolve(s.url ?? 'file'),
    );

    const refs = makeRefs([track]);
    const nav = createNavigation(refs, helpersStub, errorsStub);

    await nav.playAt(0);

    expect(h.resolveTrackSource.mock.calls[0]?.[1]?.priority).toBe(10);
  });
});
