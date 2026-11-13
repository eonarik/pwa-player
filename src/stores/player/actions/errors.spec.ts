// src/stores/player/actions/errors.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import type { PlayerActionsRefs } from './types';
import type { Track } from '@/types/track';
import { newFolderId, newTrackId, newTrackSourceId } from '@/types/ids';
import { AuthError } from '@/services/api/errors';

const h = vi.hoisted(() => ({
  showPersistent: vi.fn(),
  getProvider: vi.fn(() => ({ hasRefreshToken: () => false })),
  connectPlugin: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/ui/ToastService', () => ({
  toastService: { showPersistent: h.showPersistent, error: vi.fn() },
}));

vi.mock('@/services/api/ApiClient', () => ({
  apiClient: { getProvider: h.getProvider, registerProvider: vi.fn() },
}));

vi.mock('@/services/plugins/connectPlugin', () => ({
  connectPlugin: h.connectPlugin,
}));

import { createErrors } from './errors';
import type { Helpers } from './helpers';

function makeSource(pluginId: string, priority: number) {
  return {
    id: newTrackSourceId(),
    pluginId,
    priority,
    kind: 'cloud' as const,
    remotePath: '/x.mp3',
    folderId: newFolderId(),
  };
}

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

describe('handleAuthError', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    h.getProvider.mockReturnValue({ hasRefreshToken: () => false });
  });

  it('BUG-019: без failedSourceId предлагает приоритетный источник, а не sources[0]', () => {
    const lowPriorityFirst = makeTrack([makeSource('zvuk:1', 90), makeSource('yandexDisk:2', 5)]);

    const refs = { queue: ref([]), currentIndex: ref(0), isPlaying: ref(false), repeatMode: ref('off') } as unknown as PlayerActionsRefs;
    const helpersStub = { shouldSkipAuto: () => false } as unknown as Helpers;
    const errors = createErrors(refs, helpersStub, vi.fn());

    errors.handleAuthError(new AuthError({ providerId: 'x', reason: 'no-refresh-token' }), lowPriorityFirst);

    expect(h.showPersistent).toHaveBeenCalledTimes(1);
    // Провайдер запрошен для приоритетного плагина (priority=5 → yandexDisk).
    expect(h.getProvider).toHaveBeenCalledWith('yandexDisk');
  });

  it('с failedSourceId предлагает именно упавший источник, даже если он не приоритетный', () => {
    const track = makeTrack([makeSource('yandexDisk:1', 5), makeSource('zvuk:2', 90)]);
    const failedSource = track.sources[1]!;

    const refs = { queue: ref([]), currentIndex: ref(0), isPlaying: ref(false), repeatMode: ref('off') } as unknown as PlayerActionsRefs;
    const helpersStub = { shouldSkipAuto: () => false } as unknown as Helpers;
    const errors = createErrors(refs, helpersStub, vi.fn());

    errors.handleAuthError(new AuthError({ providerId: 'zvuk', reason: 'refresh-expired' }), track, failedSource.id);

    expect(h.getProvider).toHaveBeenCalledWith('zvuk');
  });

  it('reason=refresh-expired даёт сообщение про истёкшую сессию', () => {
    const track = makeTrack([makeSource('yandexDisk:1', 5)]);
    const refs = { queue: ref([]), currentIndex: ref(0), isPlaying: ref(false), repeatMode: ref('off') } as unknown as PlayerActionsRefs;
    const helpersStub = { shouldSkipAuto: () => false } as unknown as Helpers;
    const errors = createErrors(refs, helpersStub, vi.fn());

    errors.handleAuthError(new AuthError({ providerId: 'yandexDisk', reason: 'refresh-expired' }), track);

    const [message, , action] = h.showPersistent.mock.calls[0] as unknown as [string, string, { label: string }];
    expect(message).toContain('истекла');
    expect(action.label).toBe('Подключить');
  });
});
