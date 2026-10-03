// server/src/metadata/routes.js

import { Router } from 'express'
import { metadataSimilarity, NO_ARTIST_THRESHOLD } from './similarity.js'

export const metadataRouter = Router()

/** Кэш сырых результатов (без similarity): ключ "artist|title" */
const cache = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

const DEEZER_MIN_INTERVAL = 500
let lastDeezerRequest = 0

/** Минимальный similarity для кандидата, чтобы не тащить мусор */
const MIN_CANDIDATE_SIMILARITY = 0.3

function getCacheKey(artist, title) {
  return `${artist}|${title}`.toLowerCase()
}

function getFromCache(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry
}

/**
 * GET /api/track-metadata?artist=X&title=Y&threshold=0.5
 *
 * Возвращает:
 * - null, если ничего не нашли (даже ниже порога).
 * - { ...best, confident, candidates? } — лучший + (если !confident) все кандидаты.
 */
metadataRouter.get('/track-metadata', async (req, res) => {
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : ''
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''
  const thresholdRaw = req.query.threshold
  const threshold = typeof thresholdRaw === 'string' ? Number(thresholdRaw) : NaN

  if (!title) {
    res.status(400).json({ error: 'title is required' })
    return
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    res.status(400).json({ error: 'threshold must be a number between 0 and 1' })
    return
  }

  const effectiveThreshold = artist ? threshold : NO_ARTIST_THRESHOLD
  const cacheKey = getCacheKey(artist, title)

  let itunesResults = []
  let deezerResults = []

  const cached = getFromCache(cacheKey)
  if (cached) {
    itunesResults = cached.itunes ?? []
    deezerResults = cached.deezer ?? []
  } else {
    let itunesFailed = false
    let deezerFailed = false

    try {
      itunesResults = await searchItunes(artist, title)
    } catch (err) {
      itunesFailed = true
      console.warn('[metadata] iTunes failed:', err.message)
    }

    try {
      deezerResults = await searchDeezer(artist, title)
    } catch (err) {
      deezerFailed = true
      console.warn('[metadata] Deezer failed:', err.message)
    }

    // Кэшируем только если хотя бы один источник ответил успешно.
    // Иначе — транзиентная ошибка (сеть, 5xx), не залипаем на 24 часа.
    if (!itunesFailed || !deezerFailed) {
      cache.set(cacheKey, {
        itunes: itunesResults,
        deezer: deezerResults,
        fetchedAt: Date.now(),
      })
    }
  }

  // Считаем similarity для каждого
  const all = [...itunesResults, ...deezerResults].map((c) => ({
    ...c,
    similarity: metadataSimilarity({ artist, title }, { artist: c.artist, title: c.title }),
  }))

  // Фильтр мусора
  const filtered = all.filter((c) => c.similarity >= MIN_CANDIDATE_SIMILARITY)

  if (filtered.length === 0) {
    res.json(null)
    return
  }

  // Дедупликация по нормализованному artist + title
  const seen = new Set()
  const candidates = []
  for (const c of filtered) {
    const key = `${c.artist}|${c.title}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(c)
  }

  // Сортировка по similarity DESC
  candidates.sort((a, b) => b.similarity - a.similarity)

  const best = candidates[0]
  const confident = best.similarity >= effectiveThreshold

  res.json({
    artist: best.artist,
    title: best.title,
    album: best.album,
    coverUrl: best.coverUrl,
    source: best.source,
    similarity: best.similarity,
    confident,
    candidates: confident
      ? undefined
      : candidates.map((c) => ({
          artist: c.artist,
          title: c.title,
          album: c.album,
          coverUrl: c.coverUrl,
          source: c.source,
          similarity: c.similarity,
        })),
  })
})

// --- iTunes Search API ----------------------------------------------

async function searchItunes(artist, title) {
  const query = artist ? `${artist} ${title}` : title
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return []

    const data = await response.json()
    if (!data.results?.length) return []

    return data.results.map((r) => ({
      artist: r.artistName?.trim() || '',
      title: r.trackName?.trim() || '',
      album: r.collectionName?.trim() || '',
      coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '600x600') : null,
      source: 'itunes',
    }))
  } finally {
    clearTimeout(timeout)
  }
}

// --- Deezer API -----------------------------------------------------

async function searchDeezer(artist, title) {
  const now = Date.now()
  const elapsed = now - lastDeezerRequest
  if (elapsed < DEEZER_MIN_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, DEEZER_MIN_INTERVAL - elapsed))
  }
  lastDeezerRequest = Date.now()

  const query = artist ? `${artist} ${title}` : title
  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return []

    const data = await response.json()

    if (data.error) {
      throw new Error(`Deezer: ${data.error.message}`)
    }

    if (!data.data?.length) return []

    return data.data.map((r) => ({
      artist: r.artist?.name?.trim() || '',
      title: r.title?.trim() || '',
      album: r.album?.title?.trim() || '',
      coverUrl: r.album?.cover_xl ?? r.album?.cover_big ?? r.album?.cover_medium ?? null,
      source: 'deezer',
    }))
  } finally {
    clearTimeout(timeout)
  }
}
