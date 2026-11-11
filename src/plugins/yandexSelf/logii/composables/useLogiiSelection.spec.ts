// src/plugins/yandexSelf/logii/composables/useLogiiSelection.spec.ts

import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import type { FolderRef } from '@/types/folder';
import { newFolderId } from '@/types/ids';
import type { LogiiAuthorItem, LogiiTrackItem, UseLogiiSeasonResult } from '../useLogiiData';
import { useLogiiRoute } from './useLogiiRoute';
import { useLogiiSelection } from './useLogiiSelection';

const SEASON = 'logii.S';
const AUTHOR_PATH = `${SEASON}/uA`;

function trackItem(overrides: Partial<LogiiTrackItem> = {}): LogiiTrackItem {
  return {
    folderName: '1',
    urlPath: `${AUTHOR_PATH}/1`,
    folderId: newFolderId(),
    isIntro: false,
    audioTracks: [],
    imageFiles: [],
    logiiFileName: null,
    ...overrides,
  };
}

function authorStub(folderName = 'uA', urlPath = AUTHOR_PATH): LogiiAuthorItem {
  return { folderName, urlPath };
}

function folderStub(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'yandex-self',
    name: 'uA',
    parentId: null,
    urlPath: AUTHOR_PATH,
    trackIds: [],
    files: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
    ...overrides,
  };
}

function seasonStub(overrides: Partial<UseLogiiSeasonResult> = {}): UseLogiiSeasonResult {
  return {
    authors: ref([authorStub()]),
    tracksByAuthor: ref(new Map<string, LogiiTrackItem[]>()),
    allTracksByAuthor: ref(new Map()),
    authorMeta: ref(new Map()),
    seasonFolder: ref(null),
    isReady: ref(true),
    ...overrides,
  };
}

function setup(urlPath: string, season: UseLogiiSeasonResult = seasonStub(), folders: FolderRef[] = []) {
  const route = useLogiiRoute(ref(urlPath));
  const byId: Record<string, FolderRef> = {};
  for (const f of folders) byId[f.id] = f;
  return useLogiiSelection(season, route, computed(() => byId));
}

describe('useLogiiSelection', () => {
  it('без автора в пути ничего не выбрано', () => {
    const s = setup(SEASON);
    expect(s.currentAuthor.value).toBeNull();
    expect(s.authorFolders.value).toEqual([]);
    expect(s.currentFolder.value).toBeNull();
  });

  it('папки берутся по urlPath текущего автора', () => {
    const f1 = trackItem({ folderName: '1' });
    const f2 = trackItem({ folderName: '2' });
    const season = seasonStub({ tracksByAuthor: ref(new Map([[AUTHOR_PATH, [f1, f2]]])) });
    const s = setup(`${SEASON}/uA`, season);
    expect(s.authorFolders.value).toStrictEqual([f1, f2]);
  });

  it('автор отсутствует в списке сезона - ничего не выбрано', () => {
    const s = setup(`${SEASON}/ghost`);
    expect(s.currentAuthor.value).toBeNull();
    expect(s.authorFolders.value).toEqual([]);
  });

  it('без папки в пути выбирается интро автора, только если у него есть файл', () => {
    const intro = trackItem({ folderName: 'uA', urlPath: AUTHOR_PATH, isIntro: true, logiiFileName: 'logii.txt' });
    const withFile = seasonStub({ authorMeta: ref(new Map([[AUTHOR_PATH, intro]])) });
    expect(setup(`${SEASON}/uA`, withFile).currentFolder.value).toStrictEqual(intro);

    const noFile = seasonStub({ authorMeta: ref(new Map([[AUTHOR_PATH, intro]])) });
    noFile.authorMeta.value.get(AUTHOR_PATH)!.logiiFileName = null;
    const s = setup(`${SEASON}/uA`, noFile);
    expect(s.hasAuthorIntro.value).toBe(false);
    expect(s.currentFolder.value).toBeNull();
  });

  it('папка в пути ищется по имени, производные поля прокидываются', () => {
    const known = trackItem({ folderName: '2', urlPath: `${AUTHOR_PATH}/2`, logiiFileName: 'b.txt' });
    const season = seasonStub({ tracksByAuthor: ref(new Map([[AUTHOR_PATH, [trackItem(), known]]])) });
    const s = setup(`${SEASON}/uA/2`, season);

    expect(s.currentFolder.value).toStrictEqual(known);
    expect(s.currentFolderUrlPath.value).toBe(`${AUTHOR_PATH}/2`);
    expect(s.currentLogiiFileName.value).toBe('b.txt');

    expect(setup(`${SEASON}/uA/missing`, season).currentFolder.value).toBeNull();
  });

  it('currentAuthorFolder находит только папку своего плагина', () => {
    const own = folderStub();
    expect(setup(`${SEASON}/uA`, seasonStub(), [own]).currentAuthorFolder.value).toStrictEqual(own);

    const foreign = folderStub({ pluginId: 'radio' });
    expect(setup(`${SEASON}/uA`, seasonStub(), [foreign]).currentAuthorFolder.value).toBeNull();
    expect(setup(SEASON, seasonStub(), [own]).currentAuthorFolder.value).toBeNull();
  });
});
