// src/plugins/podcasts/PodcastStorage.ts

import type { PersistedSubscriptions, Podcast, Subscription } from './types'

const STORAGE_KEY = 'podcasts:subscriptions'
const CACHE_TTL_MS = 60 * 60 * 1000

const TOP_STORAGE_KEY = 'podcasts:cache:top'
const SEARCH_STORAGE_KEY = 'podcasts:cache:search'

// --- Подписки --------------------------------------------------------

function read(): PersistedSubscriptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { subscriptions: [], savedAt: 0 }
    const parsed = JSON.parse(raw) as PersistedSubscriptions
    if (!Array.isArray(parsed.subscriptions)) return { subscriptions: [], savedAt: 0 }
    return parsed
  } catch {
    return { subscriptions: [], savedAt: 0 }
  }
}

function write(data: PersistedSubscriptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch (err) {
    console.warn('[podcasts] failed to persist subscriptions', err)
  }
}

export function getSubscriptions(): Subscription[] {
  return read().subscriptions
}

export function isSubscribed(feedUrl: string): boolean {
  return getSubscriptions().some((s) => s.podcast.feedUrl === feedUrl)
}

export function addSubscription(subscription: Subscription): boolean {
  const data = read()
  if (data.subscriptions.some((s) => s.podcast.feedUrl === subscription.podcast.feedUrl)) {
    return false
  }
  data.subscriptions.push(subscription)
  write(data)
  return true
}

export function updateSubscription(
  feedUrl: string,
  patch: Partial<Pick<Subscription, 'episodes' | 'updatedAt'>>,
): void {
  const data = read()
  const idx = data.subscriptions.findIndex((s) => s.podcast.feedUrl === feedUrl)
  if (idx < 0) return
  data.subscriptions[idx] = { ...data.subscriptions[idx]!, ...patch }
  write(data)
}

export function removeSubscription(feedUrl: string): boolean {
  const data = read()
  const filtered = data.subscriptions.filter((s) => s.podcast.feedUrl !== feedUrl)
  if (filtered.length === data.subscriptions.length) return false
  data.subscriptions = filtered
  write(data)
  return true
}

export function clearAll(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** Проверяет, не устарел ли кеш эпизодов подкаста (TTL 1 час). */
export function isCacheFresh(sub: Subscription): boolean {
  return Date.now() - sub.updatedAt < CACHE_TTL_MS
}

// --- Кеш топа и поиска -----------------------------------------------

interface PersistedResultCache<T> {
  key: string
  data: T
  fetchedAt: number
}

export interface CacheRead<T> {
  data: T
  fresh: boolean
}

function readCache<T>(storageKey: string, key: string): CacheRead<T> | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedResultCache<T>
    if (!parsed || parsed.key !== key || typeof parsed.fetchedAt !== 'number') return null
    const age = Date.now() - parsed.fetchedAt
    return { data: parsed.data, fresh: age < CACHE_TTL_MS }
  } catch {
    return null
  }
}

function writeCache<T>(storageKey: string, key: string, data: T): void {
  try {
    const payload: PersistedResultCache<T> = { key, data, fetchedAt: Date.now() }
    localStorage.setItem(storageKey, JSON.stringify(payload))
  } catch (err) {
    console.warn('[podcasts] failed to persist cache', storageKey, err)
  }
}

export function readTopCache(
  country: string,
  genre: string | undefined,
  limit: number,
): CacheRead<Podcast[]> | null {
  return readCache<Podcast[]>(TOP_STORAGE_KEY, `${country}|${genre ?? ''}|${limit}`)
}

export function writeTopCache(
  country: string,
  genre: string | undefined,
  limit: number,
  data: Podcast[],
): void {
  writeCache(TOP_STORAGE_KEY, `${country}|${genre ?? ''}|${limit}`, data)
}

export function readSearchCache(query: string): CacheRead<Podcast[]> | null {
  return readCache<Podcast[]>(SEARCH_STORAGE_KEY, query.trim().toLowerCase())
}

export function writeSearchCache(query: string, data: Podcast[]): void {
  writeCache(SEARCH_STORAGE_KEY, query.trim().toLowerCase(), data)
}

export function clearPodcastCaches(): void {
  try {
    localStorage.removeItem(TOP_STORAGE_KEY)
    localStorage.removeItem(SEARCH_STORAGE_KEY)
  } catch {
    // ignore
  }
}
