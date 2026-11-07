// src/plugins/yandexSelf/logii/navigation.spec.ts

import { describe, it, expect } from 'vitest';
import { resolveLogiiNavigationAfterRefresh, resolveSeasonParentUrlPath } from './navigation';
import type { FolderRef } from '@/types/folder';
import { newFolderId } from '@/types/ids';

function makeFolder(overrides: Partial<FolderRef> = {}): FolderRef {
  return {
    id: newFolderId(),
    pluginId: 'yandex-self',
    name: 'folder',
    parentId: null,
    urlPath: '',
    trackIds: [],
    files: [],
    scanState: 'scanned',
    scanStateUpdatedAt: 0,
    ...overrides,
  };
}

function makeFolders(folders: FolderRef[]): Record<string, FolderRef> {
  const result: Record<string, FolderRef> = {};
  for (const f of folders) result[f.id] = f;
  return result;
}

describe('resolveLogiiNavigationAfterRefresh', () => {
  const seasonUrlPath = 'logii.2024-11-08';
  const authorName = 'userA';
  const folderName = '1';

  it("'folder' — вся цепочка существует", () => {
    const folders = makeFolders([
      makeFolder({ urlPath: seasonUrlPath }),
      makeFolder({ urlPath: `${seasonUrlPath}/${authorName}` }),
      makeFolder({ urlPath: `${seasonUrlPath}/${authorName}/${folderName}` }),
    ]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName, folderName, folders });
    expect(res.level).toBe('folder');
    expect(res.urlPath).toBe(`${seasonUrlPath}/${authorName}/${folderName}`);
  });

  it("'author' — трек-папки нет, автор есть", () => {
    const folders = makeFolders([
      makeFolder({ urlPath: seasonUrlPath }),
      makeFolder({ urlPath: `${seasonUrlPath}/${authorName}` }),
    ]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName, folderName, folders });
    expect(res.level).toBe('author');
    expect(res.urlPath).toBe(`${seasonUrlPath}/${authorName}`);
  });

  it("'season' — автора нет, сезон есть", () => {
    const folders = makeFolders([makeFolder({ urlPath: seasonUrlPath })]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName, folderName, folders });
    expect(res.level).toBe('season');
    expect(res.urlPath).toBe(seasonUrlPath);
  });

  it("'root' — сезона нет", () => {
    const folders = makeFolders([]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName, folderName, folders });
    expect(res.level).toBe('root');
    expect(res.urlPath).toBe('');
  });

  it("'author' если мы на уровне автора (folderName = null) и автор есть", () => {
    const folders = makeFolders([
      makeFolder({ urlPath: seasonUrlPath }),
      makeFolder({ urlPath: `${seasonUrlPath}/${authorName}` }),
    ]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName, folderName: null, folders });
    expect(res.level).toBe('author');
    expect(res.urlPath).toBe(`${seasonUrlPath}/${authorName}`);
  });

  it("'season' если мы на уровне сезона (authorName = null) и сезон есть", () => {
    const folders = makeFolders([makeFolder({ urlPath: seasonUrlPath })]);

    const res = resolveLogiiNavigationAfterRefresh({ seasonUrlPath, authorName: null, folderName: null, folders });
    expect(res.level).toBe('season');
    expect(res.urlPath).toBe(seasonUrlPath);
  });
});

describe('resolveSeasonParentUrlPath', () => {
  it('корень плагина → пустая строка', () => {
    const season = makeFolder({ urlPath: 'logii.2024-11-08', parentId: null });
    const folders = makeFolders([season]);
    expect(resolveSeasonParentUrlPath('logii.2024-11-08', folders)).toBe('');
  });

  it('вложенная папка → urlPath родителя', () => {
    const parent = makeFolder({ urlPath: 'Music', parentId: null });
    const season = makeFolder({ urlPath: 'Music/logii.2024-11-08', parentId: parent.id });
    const folders = makeFolders([parent, season]);
    expect(resolveSeasonParentUrlPath('Music/logii.2024-11-08', folders)).toBe('Music');
  });

  it('сезон не найден → пустая строка', () => {
    expect(resolveSeasonParentUrlPath('logii.nope', makeFolders([]))).toBe('');
  });
});
