// server/src/plugins/zvuk/service.js
import { ZvukAPI } from './sberzvuk-api.js'

const USER_TOKEN = process.env.ZVUK_TOKEN

let apiInstance = null

function getApi() {
  if (!apiInstance) {
    if (USER_TOKEN) {
      apiInstance = new ZvukAPI(USER_TOKEN)
    } else {
      throw new Error('ZVUK_TOKEN is required')
    }
  }
  return apiInstance
}

export async function searchAll(query, types, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi()

  // 1. Общий поиск
  const searchData = await api.execute('getSearchAll', { query, limit: 10 })
  const search = searchData?.search

  // Если ищем по артистам
  if (types.includes('artists')) {
    let artistId = null
    const bestMatch = search?.bestMatch

    if (bestMatch?.__typename === 'Artist') {
      artistId = bestMatch.id
    } else {
      const artists = search?.artists?.items || []
      const exact = artists.find((a) => a.title.toLowerCase().trim() === query.toLowerCase().trim())
      if (exact) artistId = exact.id
    }

    if (artistId) {
      try {
        const artistData = await api.execute('getArtist', {
          ids: [artistId],
          withPopularTracks: true,
        })
        const popular = artistData?.getArtists?.[0]?.popularTracks || []
        if (popular.length > 0) {
          return { tracks: popular, artists: [], releases: [] }
        }
      } catch (err) {
        console.warn('[zvuk] artist fetch failed', err)
      }
    }
  }

  // Если ищем по альбомам
  if (types.includes('releases')) {
    let releaseId = null
    const bestMatch = search?.bestMatch

    if (bestMatch?.__typename === 'Release') {
      releaseId = bestMatch.id
    } else {
      const releases = search?.releases?.items || []
      const exact = releases.find(
        (r) => r.title.toLowerCase().trim() === query.toLowerCase().trim(),
      )
      if (exact) releaseId = exact.id
    }

    if (releaseId) {
      try {
        const releaseData = await api.execute('getRelease', { ids: [releaseId] })
        const releaseTracks = releaseData?.getReleases?.[0]?.tracks || []
        if (releaseTracks.length > 0) {
          return { tracks: releaseTracks, artists: [], releases: [] }
        }
      } catch (err) {
        console.warn('[zvuk] release fetch failed', err)
      }
    }
  }

  // Если ищем по трекам (или если по артистам/альбомам ничего не нашли)
  const tracks = search?.tracks?.items || []
  return { tracks, artists: [], releases: [] }
}

export async function getStreamUrl(trackId, userToken) {
  const api = userToken ? new ZvukAPI(userToken) : getApi()
  const url = await api.getStreamURL(trackId)
  return url
}
