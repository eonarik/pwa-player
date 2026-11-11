// src/composables/useCollectionActions.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { newTrackId } from '@/types/ids';
import type { Track } from '@/types/track';
import type { PluginCollectionAction } from '@/plugins/types';

const h = vi.hoisted(() => ({
  getCollectionActions: vi.fn((): PluginCollectionAction[] => []),
}));

vi.mock('@/plugins/extensions', () => ({
  getCollectionActions: h.getCollectionActions,
}));

import { useCollectionActions } from './useCollectionActions';

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: newTrackId(),
    pluginId: 'local',
    artist: 'A',
    title: 'T',
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

describe('useCollectionActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('visibleCollectionActions показывает действия с shouldShow=true', async () => {
    const tracks = ref([makeTrack()]);
    const action: PluginCollectionAction = {
      id: 'act1',
      label: 'Scan',
      shouldShow: vi.fn().mockResolvedValue(true),
      run: vi.fn(),
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { visibleCollectionActions } = useCollectionActions(tracks);
    await nextTick();
    await vi.waitFor(() => {
      expect(visibleCollectionActions.value.length).toBe(1);
    });
  });

  it('shouldShow=false скрывает действие', async () => {
    const tracks = ref([makeTrack()]);
    const action: PluginCollectionAction = {
      id: 'act1',
      label: 'Scan',
      shouldShow: vi.fn().mockResolvedValue(false),
      run: vi.fn(),
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { visibleCollectionActions } = useCollectionActions(tracks);
    await vi.waitFor(() => {
      expect(visibleCollectionActions.value.length).toBe(0);
    });
  });

  it('runAction вызывает action.run с треками и ctx', async () => {
    const tracks = ref([makeTrack()]);
    const runFn = vi.fn().mockResolvedValue(undefined);
    const action: PluginCollectionAction = {
      id: 'act1',
      label: 'Scan',
      shouldShow: vi.fn().mockResolvedValue(true),
      run: runFn,
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { runAction } = useCollectionActions(tracks);
    await runAction(action, tracks.value);

    expect(runFn).toHaveBeenCalledWith(tracks.value, expect.objectContaining({ setProgress: expect.any(Function) }));
  });

  it('runAction не запускает повторно если уже выполняется', async () => {
    const tracks = ref([makeTrack()]);
    let resolveRun: () => void;
    const runFn = vi.fn().mockImplementation((_t: Track[], ctx: { setProgress: (p: unknown) => void }) => {
      ctx.setProgress({ done: 0, total: 1 });
      return new Promise<void>((r) => {
        resolveRun = r;
      });
    });
    const action: PluginCollectionAction = {
      id: 'act1',
      label: 'Scan',
      shouldShow: vi.fn().mockResolvedValue(true),
      run: runFn,
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { runAction, isActionBusy } = useCollectionActions(tracks);
    const p = runAction(action, tracks.value);

    // После первого await внутри runFn setProgress уже вызван
    await nextTick();
    expect(isActionBusy(action)).toBe(true);

    await runAction(action, tracks.value);
    expect(runFn).toHaveBeenCalledTimes(1);

    resolveRun!();
    await p;
    expect(isActionBusy(action)).toBe(false);
  });

  it('actionLabel показывает прогресс', async () => {
    const tracks = ref([makeTrack()]);
    const action: PluginCollectionAction = {
      id: 'act1',
      label: 'Scan',
      shouldShow: vi.fn().mockResolvedValue(true),
      run: vi.fn().mockResolvedValue(undefined),
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { actionLabel, actionProgress } = useCollectionActions(tracks);
    expect(actionLabel(action)).toBe('Scan');

    actionProgress.value = { act1: { done: 2, total: 5 } };
    expect(actionLabel(action)).toBe('Scan: 2/5');

    actionProgress.value = { act1: { done: 1, total: 3, found: 2 } };
    expect(actionLabel(action)).toBe('Scan: 1/3 · найдено 2');
  });

  it('ошибка shouldShow логирует warn и не добавляет действие', async () => {
    const tracks = ref([makeTrack()]);
    const action: PluginCollectionAction = {
      id: 'bad',
      label: 'Bad',
      shouldShow: vi.fn().mockRejectedValue(new Error('fail')),
      run: vi.fn(),
    };
    h.getCollectionActions.mockReturnValue([action]);

    const { visibleCollectionActions } = useCollectionActions(tracks);
    await vi.waitFor(() => {
      expect(visibleCollectionActions.value.length).toBe(0);
    });
  });
});
