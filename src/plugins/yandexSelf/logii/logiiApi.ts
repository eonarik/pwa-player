// src/plugins/yandexSelf/logii/logiiApi.ts

import { get, set, del } from 'idb-keyval';
import { yandexSelfService } from '../YandexSelfService';

const DEFAULT_LOGII_FILE_NAME = 'vibe.logii.txt';
const VIBE_TTL_MS = 5 * 60 * 1000;

interface VibeCacheEntry {
  content: string;
  modified: string | null;
  fileName: string;
  timestamp: number;
}

function normalizePath(path: string): string {
  return path
    .replace(/^disk:\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function joinPath(base: string, name: string): string {
  if (!base) return name;
  return `${base}/${name}`;
}

function cacheKey(trackUrlPath: string, fileName: string): string {
  return `logii:vibe:${trackUrlPath}|${fileName}`;
}

async function readCache(trackUrlPath: string, fileName: string | null): Promise<VibeCacheEntry | null> {
  if (!fileName) return null;
  try {
    const entry = await get<VibeCacheEntry>(cacheKey(trackUrlPath, fileName));
    if (!entry) return null;
    const age = Date.now() - entry.timestamp;
    if (age >= VIBE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

async function writeCache(
  trackUrlPath: string,
  fileName: string,
  content: string,
  modified: string | null,
): Promise<void> {
  try {
    const entry: VibeCacheEntry = {
      content,
      modified,
      fileName,
      timestamp: Date.now(),
    };
    await set(cacheKey(trackUrlPath, fileName), entry);
  } catch (err) {
    console.warn('[logii] cache write failed', err);
  }
}

export async function invalidateLogiiCache(trackUrlPath?: string): Promise<void> {
  try {
    if (!trackUrlPath) {
      // Полная инвалидация — только для debug.
      return;
    }
    // Не удаляем по одному — проще перезаписать при следующем writeCache.
  } catch {
    // ignore
  }
}

export async function readLogiiFile(
  trackUrlPath: string,
  fileName: string | null,
  forceRefresh = false,
): Promise<{ content: string; modified: string | null; fileName: string; fromCache: boolean } | null> {
  if (!fileName) return null;

  if (!forceRefresh) {
    const cached = await readCache(trackUrlPath, fileName);
    if (cached) {
      return {
        content: cached.content,
        modified: cached.modified,
        fileName: cached.fileName,
        fromCache: true,
      };
    }
  }

  const remotePath = joinPath(normalizePath(trackUrlPath), fileName);
  try {
    const result = await yandexSelfService.readTextFile(remotePath);
    if (!result) return null;
    await writeCache(trackUrlPath, fileName, result.content, result.modified);
    return {
      content: result.content,
      modified: result.modified,
      fileName,
      fromCache: false,
    };
  } catch (err) {
    // 404/500 — файла нет, не ошибка.
    console.warn('[logii] readLogiiFile failed, treating as missing', err);
    return null;
  }
}

export async function writeLogiiFile(
  trackUrlPath: string,
  fileName: string | null,
  content: string,
): Promise<{ modified: string | null; fileName: string }> {
  const targetName = fileName ?? DEFAULT_LOGII_FILE_NAME;
  const remotePath = joinPath(normalizePath(trackUrlPath), targetName);
  const result = await yandexSelfService.writeTextFile(remotePath, content);

  // Свежий контент → обновляем кеш (избегаем лишнего GET при следующем readLogiiFile).
  await writeCache(trackUrlPath, targetName, content, result.modified);

  return { modified: result.modified, fileName: targetName };
}

/**
 * Удаляет кеш для конкретного трека (по urlPath).
 * Вызывается, например, при force scan, если хочется перечитать.
 */
export async function clearLogiiCache(trackUrlPath: string): Promise<void> {
  try {
    const allKeys = await import('idb-keyval').then((m) => m.keys());
    const prefix = `logii:vibe:${trackUrlPath}|`;
    const toDelete = allKeys.filter((k) => typeof k === 'string' && k.startsWith(prefix));
    await Promise.all(toDelete.map((k) => del(k)));
  } catch (err) {
    console.warn('[logii] clearLogiiCache failed', err);
  }
}
