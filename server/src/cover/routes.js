// server/src/cover/routes.js

import { Router } from 'express'

export const coverRouter = Router()

/** Кэш в памяти: ключ "artist|title" в lowercase → результат */
const cache = new Map()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 часа

/** Минимальный интервал между запросами к Deezer (мс) */
const DEEZER_MIN_INTERVAL = 500
let lastDeezerRequest = 0

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
 * GET /api/cover?artist=X&title=Y
 * Ищет обложку: сначала iTunes, потом Deezer (fallback).
 */
coverRouter.get('/cover', async (req, res) => {
  const artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : ''
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : ''

  if (!title) {
    res.status(400).json({ error: 'title is required' })
    return
  }

  const cacheKey = getCacheKey(artist || '', title)

  // 1. Кэш
  const cached = getFromCache(cacheKey)
  if (cached) {
    res.json({ coverUrl: cached.coverUrl })
    return
  }

  let coverUrl = null
  let source = null

  // 2. iTunes первым (знает русскую музыку, не блокирует РФ)
  try {
    coverUrl = await searchItunes(artist, title)
    if (coverUrl) source = 'itunes'
  } catch (err) {
    console.warn('[cover] iTunes failed:', err.message)
  }

  // 3. Deezer как fallback
  if (!coverUrl) {
    try {
      coverUrl = await searchDeezer(artist, title)
      if (coverUrl) source = 'deezer'
    } catch (err) {
      console.warn('[cover] Deezer failed:', err.message)
    }
  }

  if (source) {
    console.info(`[cover] found via ${source}: ${artist} - ${title}`)
  }

  cache.set(cacheKey, { coverUrl, fetchedAt: Date.now() })

  res.json({ coverUrl })
})

// --- iTunes Search API ----------------------------------------------

async function searchItunes(artist, title) {
  // Если artist нет — ищем только по title
  const query = artist ? `${artist} ${title}` : title
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null

    const data = await response.json()
    if (!data.results?.length) return null

    const match = findItunesMatch(data.results, artist, title)
    if (!match?.artworkUrl100) return null

    // iTunes отдаёт 100x100 — заменяем на 600x600
    return match.artworkUrl100.replace('100x100', '600x600')
  } finally {
    clearTimeout(timeout)
  }
}

function findItunesMatch(tracks, artist, title) {
  const a = (artist || '').toLowerCase()
  const t = title.toLowerCase()

  // 1. Точное совпадение artist + title
  if (a) {
    for (const track of tracks) {
      const trackArtist = (track.artistName || '').toLowerCase()
      const trackTitle = (track.trackName || '').toLowerCase()
      if (trackArtist === a && trackTitle === t) return track
    }
  }

  // 2. Artist совпадает, title содержит запрос
  if (a) {
    for (const track of tracks) {
      const trackArtist = (track.artistName || '').toLowerCase()
      const trackTitle = (track.trackName || '').toLowerCase()
      if (trackArtist === a && trackTitle.includes(t)) return track
    }
  }

  // 3. Title точно совпадает (даже если artist не совпал)
  for (const track of tracks) {
    const trackTitle = (track.trackName || '').toLowerCase()
    if (trackTitle === t) return track
  }

  // 4. Первый с обложкой
  for (const track of tracks) {
    if (track.artworkUrl100) return track
  }

  return null
}

// --- Deezer API -----------------------------------------------------

async function searchDeezer(artist, title) {
  // Throttling — не чаще одного запроса в DEEZER_MIN_INTERVAL мс
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
    if (!response.ok) return null

    const data = await response.json()

    if (data.error) {
      // Quota limit exceeded — не падаем, просто возвращаем null
      throw new Error(`Deezer: ${data.error.message}`)
    }

    if (!data.data?.length) return null

    const match = findDeezerMatch(data.data, artist, title)
    return match?.album?.cover_xl ?? match?.album?.cover_big ?? null
  } finally {
    clearTimeout(timeout)
  }
}

function findDeezerMatch(tracks, artist, title) {
  const a = (artist || '').toLowerCase()
  const t = title.toLowerCase()

  if (a) {
    for (const track of tracks) {
      if (track.artist.name.toLowerCase() === a && track.title.toLowerCase() === t) {
        return track
      }
    }

    for (const track of tracks) {
      const trackArtist = track.artist.name.toLowerCase()
      const trackTitle = track.title.toLowerCase()
      if (trackArtist === a && trackTitle.includes(t)) return track
    }
  }

  for (const track of tracks) {
    if (track.title.toLowerCase() === t) return track
  }

  for (const track of tracks) {
    if (track.album?.cover_xl || track.album?.cover_big) return track
  }

  return null
}
