// server/src/plugins/zvuk/service.js

import { ZvukAPI, RateLimitError } from './sberzvuk-api.js';
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

function titleContainmentScore(a, b) {
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 5) return 0;
  return longer.includes(shorter) ? 1 : 0;
}

async function queryZvuk(query, types, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi();

  let searchQuery = query;
  const lowerQuery = query.trim().toLowerCase();
  if (ARTIST_ALIASES[lowerQuery]) {
    searchQuery = ARTIST_ALIASES[lowerQuery][0];
  }

  const searchData = await api.execute('getSearchAll', { query: searchQuery, limit: 10 });
  const search = searchData?.search;

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
        const validPopular = popular.filter((t) => t != null);
        if (validPopular.length > 0) {
          return { tracks: validPopular, artists: [], releases: [] };
        }
      } catch (err) {
        if (err instanceof RateLimitError) throw err;
        console.warn('[zvuk] artist fetch failed', err);
      }
    }
  }

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
        if (err instanceof RateLimitError) throw err;
        console.warn('[zvuk] release fetch failed', err);
      }
    }
  }

  const rawTracks = search?.tracks?.items || [];
  const tracks = rawTracks.filter((t) => t != null);
  return { tracks, artists: [], releases: [] };
}

export async function searchAll(query, types, userToken) {
  return queryZvuk(query, types, userToken);
}

export async function searchMetadataStrict(artist, title, userToken) {
  const artistVariants = getArtistSearchVariants(artist);

  let targetArtists = artistVariants;
  if (artistVariants.length > 1) {
    targetArtists = artistVariants.slice(1);
  }

  const searchQueries = targetArtists.length > 0 ? targetArtists.map((a) => `${a} ${title}`) : [];
  if (title && searchQueries.length === 0) {
    searchQueries.push(title);
  }

  let bestMatch = null;
  let bestScore = 0;

  const targetTitle = (title || '').toLowerCase().trim();

  for (const query of searchQueries) {
    try {
      const result = await queryZvuk(query, ['tracks'], userToken);
      const rawTracks = result.tracks;

      if (rawTracks.length === 0) continue;

      for (const track of rawTracks) {
        const trackArtistTitles = (track.artists || []).map((a) => a.title.toLowerCase().trim());
        const trackTitle = (track.title || '').toLowerCase().trim();

        const isExactArtistMatch = artistVariants.some((variant) => {
          const v = variant.toLowerCase().trim();
          return trackArtistTitles.includes(v) || v === trackArtistTitles.join(', ');
        });

        let artistScore = 0;
        if (isExactArtistMatch) {
          artistScore = 1;
        } else {
          let maxRatio = 0;
          for (const variant of artistVariants) {
            for (const ta of trackArtistTitles) {
              const r = fuzzball.ratio(variant.toLowerCase().trim(), ta);
              if (r > maxRatio) maxRatio = r;
            }
          }
          artistScore = maxRatio / 100;
          if (artistScore < 0.8) artistScore = 0;
        }

        const titleScoreFuzzy = fuzzball.ratio(targetTitle, trackTitle) / 100;
        const titleScoreContain = titleContainmentScore(targetTitle, trackTitle);
        const titleScore = Math.max(titleScoreFuzzy, titleScoreContain);

        if (artistScore === 0) {
          if (titleScore > 0.95) {
            const finalScore = titleScore * 0.5;
            if (finalScore > bestScore) {
              bestScore = finalScore;
              bestMatch = track;
            }
          }
          continue;
        }

        const finalScore = titleScore * 0.8 + artistScore * 0.2;
        if (finalScore > bestScore) {
          bestScore = finalScore;
          bestMatch = track;
        }
      }

      console.log(`[zvuk] success for "${query}". score: ${bestScore}`);
      if (bestScore > 0.95) break;
    } catch (err) {
      if (err instanceof RateLimitError) {
        throw err;
      }
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
    trackId: bestMatch.id ? String(bestMatch.id) : undefined,
  };
}

export async function getStreamUrl(trackId, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi();
  const url = await api.getStreamURL(trackId);
  return url;
}
