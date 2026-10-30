// server/src/metadata/routes.js

import { Router } from 'express';
import { metadataSimilarity, NO_ARTIST_THRESHOLD } from './similarity.js';
import { parseArtistAndTitle } from './parseTitle.js';
import { getArtistSearchVariants } from '../shared/aliases.js';

export const metadataRouter = Router();

/** Кэш сырых результатов (без similarity): ключ "artist|title" */
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DEEZER_MIN_INTERVAL = 500;
let lastDeezerRequest = 0;

const MIN_CANDIDATE_SIMILARITY = 0.3;

function getCacheKey(artist, title) {
  return `${artist}|${title}`.toLowerCase();
}

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

metadataRouter.get('/track-metadata', async (req, res) => {
  let artist = typeof req.query.artist === 'string' ? req.query.artist.trim() : '';
  let title = typeof req.query.title === 'string' ? req.query.title.trim() : '';

  if (!artist && title) {
    const parsed = parseArtistAndTitle(title);
    if (parsed.artist) {
      artist = parsed.artist;
      title = parsed.title;
    }
  }

  const thresholdRaw = req.query.threshold;
  const threshold = typeof thresholdRaw === 'string' ? Number(thresholdRaw) : NaN;

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    res.status(400).json({ error: 'threshold must be a number between 0 and 1' });
    return;
  }

  const effectiveThreshold = artist ? threshold : NO_ARTIST_THRESHOLD;
  const cacheKey = getCacheKey(artist, title);

  let itunesResults = [];
  let deezerResults = [];

  const cached = getFromCache(cacheKey);
  if (cached) {
    itunesResults = cached.itunes ?? [];
    deezerResults = cached.deezer ?? [];
  } else {
    let itunesFailed = false;
    let deezerFailed = false;

    // 1. Получаем список запросов (оригинал + алиасы)
    const artistVariants = getArtistSearchVariants(artist);

    // Формируем готовые строки для поиска
    const searchQueries = artistVariants.length > 0 ? artistVariants.map((a) => `${a} ${title}`) : [title];

    // 2. Пробуем каждый вариант
    for (const query of searchQueries) {
      try {
        const [itunesData, deezerData] = await Promise.all([
          searchItunes(query), // Передаем готовый query
          searchDeezer(query),
        ]);

        itunesResults.push(...itunesData);
        deezerResults.push(...deezerData);

        if (itunesResults.length > 0 || deezerResults.length > 0) {
          break;
        }
      } catch (err) {
        console.warn(`[metadata] Search failed for "${query}":`, err.message);
        if (query === searchQueries[0]) {
          itunesFailed = true;
          deezerFailed = true;
        }
      }
    }

    if (!itunesFailed || !deezerFailed) {
      cache.set(cacheKey, {
        itunes: itunesResults,
        deezer: deezerResults,
        fetchedAt: Date.now(),
      });
    }
  }

  const all = [...itunesResults, ...deezerResults].map((c) => ({
    ...c,
    similarity: metadataSimilarity({ artist, title }, { artist: c.artist, title: c.title }),
  }));

  const filtered = all.filter((c) => c.similarity >= MIN_CANDIDATE_SIMILARITY);

  if (filtered.length === 0) {
    res.json(null);
    return;
  }

  const seen = new Set();
  const candidates = [];
  for (const c of filtered) {
    const key = `${c.artist}|${c.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(c);
  }

  candidates.sort((a, b) => b.similarity - a.similarity);

  const best = candidates[0];
  const confident = best.similarity >= effectiveThreshold;

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
  });
});

// --- iTunes Search API ----------------------------------------------

async function searchItunes(query) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const data = await response.json();
    if (!data.results?.length) return [];

    return data.results.map((r) => ({
      artist: r.artistName?.trim() || '',
      title: r.trackName?.trim() || '',
      album: r.collectionName?.trim() || '',
      coverUrl: r.artworkUrl100 ? r.artworkUrl100.replace('100x100', '600x600') : null,
      source: 'itunes',
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// --- Deezer API -----------------------------------------------------

async function searchDeezer(query) {
  const now = Date.now();
  const elapsed = now - lastDeezerRequest;
  if (elapsed < DEEZER_MIN_INTERVAL) {
    await new Promise((resolve) => setTimeout(resolve, DEEZER_MIN_INTERVAL - elapsed));
  }
  lastDeezerRequest = Date.now();

  const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const data = await response.json();

    if (data.error) {
      throw new Error(`Deezer: ${data.error.message}`);
    }

    if (!data.data?.length) return [];

    return data.data.map((r) => ({
      artist: r.artist?.name?.trim() || '',
      title: r.title?.trim() || '',
      album: r.album?.title?.trim() || '',
      coverUrl: r.album?.cover_xl ?? r.album?.cover_big ?? r.album?.cover_medium ?? null,
      source: 'deezer',
    }));
  } finally {
    clearTimeout(timeout);
  }
}
