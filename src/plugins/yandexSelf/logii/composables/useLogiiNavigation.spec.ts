// src/plugins/yandexSelf/logii/composables/useLogiiNavigation.spec.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import { newFolderId } from '@/types/ids';
import type { LogiiAuthorItem, LogiiTrackItem } from '../useLogiiData';
import { useLogiiRoute } from './useLogiiRoute';
import { useLogiiNavigation } from './useLogiiNavigation';

const SEASON = 'logii.S';

function folderStub(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'yandex-self',
    name: 'season',
    parentId: null,
    urlPath: SEASON,
    trackIds: [],
    files: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
    ...overrides,
  };
}

function trackItem(overrides: Partial<LogiiTrackItem> = {}): LogiiTrackItem {
  return {
    folderName: '1',
    urlPath: `${SEASON}/uA/1`,
    folderId: newFolderId(),
    isIntro: false,
    audioTracks: [],
    imageFiles: [],
    logiiFileName: null,
    ...overrides,
  };
}

function setup(urlPath: string, folders: FolderRef[] = [], currentAuthor: LogiiAuthorItem | null = null) {
  const router = { push: vi.fn(), replace: vi.fn() };
  const route = useLogiiRoute(ref(urlPath));
  const byId: Record<string, FolderRef> = {};
  for (const f of folders) byId[f.id] = f;

  const api = useLogiiNavigation({
    route,
    currentAuthor: computed(() => currentAuthor),
    folders: computed(() => byId),
    router,
  });
  return { ...api, router };
}

describe('useLogiiNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('goToAuthor дописывает имя автора к сегментам сезона', () => {
    const { goToAuthor, router } = setup('root/x/logii.S');
    goToAuthor({ folderName: 'uA', urlPath: 'root/x/logii.S/uA' });

    expect(router.replace).toHaveBeenCalledTimes(1);
    const to = router.replace.mock.calls[0]![0] as { params: { pluginId: string; path: string[] } };
    expect(to.params.pluginId).toBe('yandex-self');
    expect(to.params.path).toEqual(['root', 'x', 'logii.S', 'uA']);
  });

  it('goToFolder строит путь сезон/автор/папка, без автора молчит', () => {
    const { goToFolder, router } = setup(`${SEASON}/uA`);
    goToFolder(trackItem({ folderName: '2' }));

    const to = router.replace.mock.calls[0]![0] as { params: { path: string[] } };
    expect(to.params.path).toEqual([SEASON, 'uA', '2']);

    const noAuthor = setup(SEASON);
    noAuthor.goToFolder(trackItem());
    expect(noAuthor.router.replace).not.toHaveBeenCalled();
  });

  it('goToIntro использует текущего автора, без автора молчит', () => {
    const withAuthor = setup(`${SEASON}/uA`, [], { folderName: 'uA', urlPath: `${SEASON}/uA` });
    withAuthor.goToIntro();
    expect(withAuthor.router.replace).toHaveBeenCalledTimes(1);

    const empty = setup(SEASON);
    empty.goToIntro();
    expect(empty.router.replace).not.toHaveBeenCalled();
  });

  it('goToParent ведёт к родителю сезона, а без сезона - в корень плагина', () => {
    const parent = folderStub({ urlPath: 'root/x' });
    const season = folderStub({ parentId: parent.id, urlPath: SEASON });
    const { goToParent, router } = setup(SEASON, [parent, season]);
    goToParent();

    const to = router.push.mock.calls[0]![0] as { params: { path: string[] } };
    expect(to.params.path).toEqual(['root', 'x']);

    const noSeason = setup('a/b');
    expect(noSeason.canGoToParent.value).toBe(false);
    noSeason.goToParent();
    const fallback = noSeason.router.push.mock.calls[0]![0] as { params: { path: string[] } };
    expect(fallback.params.path).toEqual([]);
  });

  it('canGoToParent истинен при наличии сезона', () => {
    expect(setup(SEASON).canGoToParent.value).toBe(true);
    expect(setup('a/b').canGoToParent.value).toBe(false);
  });
});
