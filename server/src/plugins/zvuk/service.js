// server/src/plugins/zvuk/service.js

import { ZvukAPI } from './sberzvuk-api.js';
import * as fuzzball from 'fuzzball';
import { getArtistSearchVariants, ARTIST_ALIASES } from '../../shared/aliases.js';

const USER_TOKEN = process.env.ZVUK_TOKEN;

let apiInstance = null;

function getApi() {
  if (!apiInstance) {
    if (USER_TOKEN) {
      apiInstance = new ZvukAPI(USER_TOKEN);
    } else {
      throw new Error('ZVUK_TOKEN is required');
    }
  }
  return apiInstance;
}

export async function searchAll(query, types, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi();

  // 1. Проверяем, есть ли точный алиас для всего запроса
  let searchQuery = query;
  const lowerQuery = query.trim().toLowerCase();

  if (ARTIST_ALIASES[lowerQuery]) {
    searchQuery = ARTIST_ALIASES[lowerQuery][0]; // Берем первый алиас
  }

  // 2. Общий поиск
  const searchData = await api.execute('getSearchAll', { query: searchQuery, limit: 10 });
  const search = searchData?.search;

  // Если ищем по артистам
  if (types.includes('artists')) {
    let artistId = null;
    const bestMatch = search?.bestMatch;

    if (bestMatch?.__typename === 'Artist') {
      artistId = bestMatch.id;
    } else {
      const artists = search?.artists?.items || [];
      const exact = artists.find((a) => a.title.toLowerCase().trim() === searchQuery.toLowerCase().trim());
      if (exact) artistId = exact.id;
    }

    if (artistId) {
      try {
        const artistData = await api.execute('getArtist', {
          ids: [artistId],
          withPopularTracks: true,
        });
        const popular = artistData?.getArtists?.[0]?.popularTracks || [];
        // API Звука иногда возвращает null в массиве (битые треки)
        const validPopular = popular.filter((t) => t != null);

        if (validPopular.length > 0) {
          return { tracks: validPopular, artists: [], releases: [] };
        }
      } catch (err) {
        console.warn('[zvuk] artist fetch failed', err);
      }
    }
  }

  // Если ищем по альбомам
  if (types.includes('releases')) {
    let releaseId = null;
    const bestMatch = search?.bestMatch;

    if (bestMatch?.__typename === 'Release') {
      releaseId = bestMatch.id;
    } else {
      const releases = search?.releases?.items || [];
      const exact = releases.find((r) => r.title.toLowerCase().trim() === searchQuery.toLowerCase().trim());
      if (exact) releaseId = exact.id;
    }

    if (releaseId) {
      try {
        const releaseData = await api.execute('getRelease', { ids: [releaseId] });
        const releaseTracks = releaseData?.getReleases?.[0]?.tracks || [];
        const validReleaseTracks = releaseTracks.filter((t) => t != null);

        if (validReleaseTracks.length > 0) {
          return { tracks: validReleaseTracks, artists: [], releases: [] };
        }
      } catch (err) {
        console.warn('[zvuk] release fetch failed', err);
      }
    }
  }

  // Если ищем по трекам (или если по артистам/альбомам ничего не нашли)
  const rawTracks = search?.tracks?.items || [];
  const tracks = rawTracks.filter((t) => t != null);

  return { tracks, artists: [], releases: [] };
}

/**
 * Строгий поиск метаданных (artist + title) с использованием алиасов.
 */
export async function searchMetadataStrict(artist, title, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi();

  // 1. Получаем варианты из ядрового словаря
  const artistVariants = getArtistSearchVariants(artist);

  // 2. Формируем список запросов
  const searchQueries = artistVariants.length > 0 ? artistVariants.map((a) => `${a} ${title}`) : [];

  // Фоллбек: только по названию
  searchQueries.push(title);

  let bestMatch = null;
  let bestScore = 0;

  // 3. Проходимся по всем вариантам
  for (const query of searchQueries) {
    try {
      const searchData = await api.execute('getSearchAll', { query, limit: 10 });
      const rawTracks = searchData?.search?.tracks?.items || [];

      if (rawTracks.length === 0) continue;

      const trackIds = rawTracks.map((t) => t.id).filter(Boolean);
      if (trackIds.length === 0) continue;

      const fullData = await api.execute('getTracks', { ids: trackIds });
      const fullTracks = fullData?.getTracks || [];

      const targetArtist = (artist || '').toLowerCase().trim();
      const targetTitle = (title || '').toLowerCase().trim();

      for (const track of fullTracks) {
        const trackArtistTemplate = (track.artistTemplate || '').toLowerCase().trim();
        const trackArtists = track.artists?.map((a) => a.title).join(', ') || '';
        const trackArtist = trackArtists.toLowerCase().trim();
        const trackTitle = (track.title || '').toLowerCase().trim();

        // Считаем скор
        const artistScore1 = fuzzball.ratio(targetArtist, trackArtist) / 100;
        const artistScore2 = fuzzball.ratio(targetArtist, trackArtistTemplate) / 100;

        // Проверяем совпадение с алиасами
        const aliasScore = artistVariants.some((alias) =>
          fuzzball.ratio(alias.toLowerCase(), trackArtist) > 0.9 ? 1 : 0,
        );

        const artistScore = Math.max(artistScore1, artistScore2, aliasScore);
        const titleScore = fuzzball.ratio(targetTitle, trackTitle) / 100;

        let finalScore = 0;
        if (artistScore > 0.8) {
          finalScore = titleScore * 0.8 + artistScore * 0.2;
        } else if (titleScore > 0.95) {
          // Если тайтл идеален, но артист не совпал — это может быть кавер или фит
          finalScore = titleScore * 0.5;
        }

        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = track;
        }
      }

      // Если нашли идеальное совпадение, дальше не ищем
      if (bestScore > 0.95) break;
    } catch (err) {
      console.warn(`[zvuk] Metadata search failed for "${query}"`, err);
    }
  }

  if (bestScore < 0.85 || !bestMatch) {
    return null;
  }

  return {
    artist: bestMatch.artists?.map((a) => a.title).join(', ') || '',
    title: bestMatch.title,
    album: bestMatch.release?.title || '',
    coverUrl: bestMatch.release?.image?.src?.replace('{size}', '600') || null,
    source: 'zvuk',
    similarity: bestScore,
    confident: bestScore >= 0.9,
  };
}

export async function getStreamUrl(trackId, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi();
  const url = await api.getStreamURL(trackId);
  return url;
}
