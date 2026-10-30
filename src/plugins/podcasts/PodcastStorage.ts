// src/plugins/podcasts/PodcastStorage.ts

import { get, set } from 'idb-keyval';
import type { PersistedSubscriptions, Podcast, Subscription } from './types';

const STORAGE_KEY = 'podcasts:subscriptions'; // idb-keyval под капотом использует другое хранилище
const CACHE_TTL_MS = 60 * 60 * 1000;

// --- Подписки --------------------------------------------------------

async function read(): Promise<PersistedSubscriptions> {
  try {
    const data = await get<PersistedSubscriptions>(STORAGE_KEY);
    if (data && Array.isArray(data.subscriptions)) return data;
    return { subscriptions: [], savedAt: 0 };
  } catch {
    return { subscriptions: [], savedAt: 0 };
  }
}

async function write(data: PersistedSubscriptions): Promise<void> {
  try {
    await set(STORAGE_KEY, { ...data, savedAt: Date.now() });
  } catch (err) {
    console.error('[podcasts] failed to persist subscriptions in IDB', err);
    throw err; // пробрасываем дальше, чтобы вызывающий знал
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  return (await read()).subscriptions;
}

export async function isSubscribed(feedUrl: string): Promise<boolean> {
  const subs = await getSubscriptions();
  return subs.some((s) => s.podcast.feedUrl === feedUrl);
}

export async function addSubscription(subscription: Subscription): Promise<boolean> {
  const data = await read();
  if (data.subscriptions.some((s) => s.podcast.feedUrl === subscription.podcast.feedUrl)) {
    return false;
  }
  data.subscriptions.push(subscription);
  await write(data);
  return true;
}

export async function updateSubscription(
  feedUrl: string,
  patch: Partial<Pick<Subscription, 'episodes' | 'updatedAt'>>,
): Promise<void> {
  const data = await read();
  const idx = data.subscriptions.findIndex((s) => s.podcast.feedUrl === feedUrl);
  if (idx < 0) return;
  data.subscriptions[idx] = { ...data.subscriptions[idx]!, ...patch };
  await write(data);
}

export async function removeSubscription(feedUrl: string): Promise<boolean> {
  const data = await read();
  const filtered = data.subscriptions.filter((s) => s.podcast.feedUrl !== feedUrl);
  if (filtered.length === data.subscriptions.length) return false;
  data.subscriptions = filtered;
  await write(data);
  return true;
}

export async function clearAll(): Promise<void> {
  try {
    await set(STORAGE_KEY, { subscriptions: [], savedAt: Date.now() });
  } catch (err) {
    console.error('[podcasts] failed to clear subscriptions', err);
  }
}

export function isCacheFresh(sub: Subscription): boolean {
  return Date.now() - sub.updatedAt < CACHE_TTL_MS;
}

// --- Кеш топа и поиска (остаётся в localStorage, это лёгкие данные) ---

const TOP_STORAGE_KEY = 'podcasts:cache:top';
const SEARCH_STORAGE_KEY = 'podcasts:cache:search';

interface PersistedResultCache<T> {
  key: string;
  data: T;
  fetchedAt: number;
}

export interface CacheRead<T> {
  data: T;
  fresh: boolean;
}

function readCache<T>(storageKey: string, key: string): CacheRead<T> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedResultCache<T>;
    if (!parsed || parsed.key !== key || typeof parsed.fetchedAt !== 'number') return null;
    const age = Date.now() - parsed.fetchedAt;
    return { data: parsed.data, fresh: age < CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeCache<T>(storageKey: string, key: string, data: T): void {
  try {
    const payload: PersistedResultCache<T> = { key, data, fetchedAt: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (err) {
    console.warn('[podcasts] failed to persist cache', storageKey, err);
  }
}

export function readTopCache(country: string, genre: string | undefined, limit: number): CacheRead<Podcast[]> | null {
  return readCache<Podcast[]>(TOP_STORAGE_KEY, `${country}|${genre ?? ''}|${limit}`);
}

export function writeTopCache(country: string, genre: string | undefined, limit: number, data: Podcast[]): void {
  writeCache(TOP_STORAGE_KEY, `${country}|${genre ?? ''}|${limit}`, data);
}

export function readSearchCache(query: string): CacheRead<Podcast[]> | null {
  return readCache<Podcast[]>(SEARCH_STORAGE_KEY, query.trim().toLowerCase());
}

export function writeSearchCache(query: string, data: Podcast[]): void {
  writeCache(SEARCH_STORAGE_KEY, query.trim().toLowerCase(), data);
}

export function clearPodcastCaches(): void {
  try {
    localStorage.removeItem(TOP_STORAGE_KEY);
    localStorage.removeItem(SEARCH_STORAGE_KEY);
  } catch {
    // ignore
  }
}
