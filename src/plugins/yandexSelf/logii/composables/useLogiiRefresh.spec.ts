// src/plugins/yandexSelf/logii/composables/useLogiiRefresh.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import { newFolderId } from '@/types/ids';
import { useLogiiRoute } from './useLogiiRoute';
import { useLogiiRefresh } from './useLogiiRefresh';

const h = vi.hoisted(() => ({
  loadPlugin: vi.fn(async (): Promise<{ scanFolder?: unknown }> => ({})),
  createPluginContext: vi.fn(() => ({})),
  scanFolder: vi.fn(async (): Promise<unknown> => ({})),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/plugins/registry', () => ({ loadPlugin: h.loadPlugin }));
vi.mock('@/plugins/context', () => ({ createPluginContext: h.createPluginContext }));
vi.mock('@/services/ui/ToastService', () => ({ toastService: { success: h.success, error: h.error } }));

function folderStub(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'yandex-self',
    name: 'season',
    parentId: null,
    urlPath: 'logii.S',
    trackIds: [],
    files: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
    ...overrides,
  };
}

function setup(
  options: {
    urlPath?: string;
    seasonFolder?: FolderRef | null;
    folders?: FolderRef[];
    scanFolder?: unknown;
  } = {},
) {
  const seasonFolder = ref<FolderRef | null>(options.seasonFolder === undefined ? folderStub() : options.seasonFolder);
  const byId: Record<string, FolderRef> = {};
  for (const f of options.folders ?? []) byId[f.id] = f;

  const router = { push: vi.fn(), replace: vi.fn() };
  const reloadTrack = vi.fn(async (): Promise<void> => undefined);
  const api = useLogiiRefresh({
    seasonFolder,
    route: useLogiiRoute(ref(options.urlPath ?? 'logii.S/uA/1')),
    folders: computed(() => byId),
    router,
    reloadTrack,
  });
  return { ...api, router, reloadTrack, seasonFolder };
}

describe('useLogiiRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.loadPlugin.mockImplementation(async () => ({ scanFolder: h.scanFolder }));
    h.scanFolder.mockImplementation(async () => ({}));
  });

  it('без сезонной папки сканирование не запускается', async () => {
    const { onRefresh } = setup({ seasonFolder: null });
    await onRefresh();
    expect(h.loadPlugin).not.toHaveBeenCalled();
  });

  it('повторный вызов во время обновления игнорируется', async () => {
    let resolveScan: (value: unknown) => void = () => {};
    h.scanFolder.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );

    const { onRefresh, isRefreshing } = setup({
      folders: [folderStub(), folderStub({ urlPath: 'logii.S/uA' }), folderStub({ urlPath: 'logii.S/uA/1' })],
    });

    const first = onRefresh();
    expect(isRefreshing.value).toBe(true);

    await vi.waitFor(() => expect(h.scanFolder).toHaveBeenCalledTimes(1));

    const second = onRefresh();
    expect(h.scanFolder).toHaveBeenCalledTimes(1);
    expect(isRefreshing.value).toBe(true);

    resolveScan({});
    await Promise.all([first, second]);
    expect(isRefreshing.value).toBe(false);
  });

  it('плагин без поддержки сканирования - ошибка и никакого навигирования', async () => {
    h.loadPlugin.mockImplementation(async () => ({}));
    const { onRefresh, router } = setup();

    await onRefresh();

    expect(h.error).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('исчезновение сезона после скана - переход в корень плагина', async () => {
    const { onRefresh, router, reloadTrack } = setup({ folders: [] });

    await onRefresh();

    const to = router.push.mock.calls[0]![0] as { params: { path: string[] } };
    expect(to.params.path).toEqual([]);
    expect(reloadTrack).not.toHaveBeenCalled();
    expect(h.success).toHaveBeenCalledTimes(1);
  });

  it('пропавшая трек-папка - переход к ближайшему живому уровню', async () => {
    const { onRefresh, router, reloadTrack } = setup({
      folders: [folderStub(), folderStub({ urlPath: 'logii.S/uA' })],
    });

    await onRefresh();

    const to = router.push.mock.calls[0]![0] as { params: { path: string[] } };
    expect(to.params.path).toEqual(['logii.S', 'uA']);
    expect(reloadTrack).not.toHaveBeenCalled();
  });

  it('цепочка цела - перезагружаем трек принудительно', async () => {
    const { onRefresh, reloadTrack, router } = setup({
      folders: [folderStub(), folderStub({ urlPath: 'logii.S/uA' }), folderStub({ urlPath: 'logii.S/uA/1' })],
    });

    await onRefresh();

    expect(reloadTrack).toHaveBeenCalledWith(true);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('сбой сканирования - ошибка и сб флага', async () => {
    h.scanFolder.mockImplementation(async () => {
      throw new Error('boom');
    });
    const { onRefresh, isRefreshing, reloadTrack } = setup();

    await onRefresh();

    expect(h.error).toHaveBeenCalledTimes(1);
    expect(reloadTrack).not.toHaveBeenCalled();
    expect(isRefreshing.value).toBe(false);
  });
});
