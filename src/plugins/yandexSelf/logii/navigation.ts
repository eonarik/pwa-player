// src/plugins/yandexSelf/logii/navigation.ts

import type { FolderRef } from '@/types/folder';
import type { FolderId } from '@/types/ids';

export type LogiiNavLevel = 'folder' | 'author' | 'season' | 'root';

export interface LogiiNavResult {
  /** Куда переходить после refresh. */
  level: LogiiNavLevel;
  /**
   * Куда навигировать:
   * - 'folder' / 'author' / 'season' → urlPath (относительно плагина yandex-self);
   * - 'root' → пустая строка '' (caller сам решает, что делать).
   */
  urlPath: string;
}

export interface LogiiNavContext {
  seasonUrlPath: string;
  authorName: string | null;
  folderName: string | null;
  folders: Record<string, FolderRef>;
}

function findFolderByUrlPath(folders: Record<string, FolderRef>, urlPath: string): FolderRef | null {
  const normalized = urlPath.replace(/^\/+/, '').replace(/\/+$/, '');
  for (const f of Object.values(folders)) {
    if (f.urlPath === normalized) return f;
  }
  return null;
}

function joinUrlPath(...segments: Array<string | null | undefined>): string {
  return segments.filter((s): s is string => Boolean(s)).join('/');
}

/**
 * После рекурсивного refresh сезона (scanFolder с force: true) проверяет,
 * что текущая цепочка «сезон → автор → трек-папка» ещё существует.
 *
 * Возвращает ближайший существующий уровень:
 * - 'folder' — текущая трек-папка цела;
 * - 'author' — трек-папки нет, но автор есть;
 * - 'season' — автора нет, но сезон есть;
 * - 'root'   — сезона нет.
 *
 * Вызывается ТОЛЬКО после await scanFolder(...), когда library.folders уже
 * содержит актуальные данные (Vue-реактивность синхронна для этого map).
 */
export function resolveLogiiNavigationAfterRefresh(ctx: LogiiNavContext): LogiiNavResult {
  const { seasonUrlPath, authorName, folderName, folders } = ctx;

  if (!seasonUrlPath) {
    return { level: 'root', urlPath: '' };
  }

  const seasonExists = findFolderByUrlPath(folders, seasonUrlPath) !== null;
  if (!seasonExists) {
    return { level: 'root', urlPath: '' };
  }

  if (!authorName) {
    return { level: 'season', urlPath: seasonUrlPath };
  }

  const authorUrlPath = joinUrlPath(seasonUrlPath, authorName);
  const authorExists = findFolderByUrlPath(folders, authorUrlPath) !== null;
  if (!authorExists) {
    return { level: 'season', urlPath: seasonUrlPath };
  }

  if (!folderName) {
    return { level: 'author', urlPath: authorUrlPath };
  }

  const folderUrlPath = joinUrlPath(authorUrlPath, folderName);
  const folderExists = findFolderByUrlPath(folders, folderUrlPath) !== null;
  if (!folderExists) {
    return { level: 'author', urlPath: authorUrlPath };
  }

  return { level: 'folder', urlPath: folderUrlPath };
}

/**
 * Возвращает urlPath родительской папки для `logii.<season>`.
 * Если сезон лежит в корне плагина — возвращает '' (корень FolderView).
 *
 * Нужно для кнопки «К папкам» в LogiiPanelHeader.
 */
export function resolveSeasonParentUrlPath(seasonUrlPath: string, folders: Record<string, FolderRef>): string {
  const season = findFolderByUrlPath(folders, seasonUrlPath);
  if (!season) return '';
  if (season.parentId === null) return '';

  const parent: FolderRef | undefined = folders[season.parentId as FolderId];
  if (!parent) return '';

  return parent.urlPath;
}
