// src/services/library/EntityGraph.ts

import type { Album, LibraryTrack } from '@/types/library'

export function createAlbumId(albumName: string, artist: string): string | undefined {
  const cleanAlbum = albumName.trim()
  if (!cleanAlbum) return undefined

  const normalizedAlbum = cleanAlbum
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '-')
    .replace(/-+/g, '-')
  const normalizedArtist = (artist || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '-')
    .replace(/-+/g, '-')

  return `album:${normalizedArtist}:${normalizedAlbum}`
}

export interface EntityGraphResult {
  track: LibraryTrack
  album: Album | null
}

export function buildEntitiesForTrack(track: LibraryTrack): EntityGraphResult {
  const albumName = track.album?.trim() || ''
  const albumId = createAlbumId(albumName, track.artist || '')

  if (!albumId) {
    return { track: { ...track, albumId: undefined }, album: null }
  }

  // Берем обложку из raw (исходные метаданные)
  const coverUrl = track.raw?.coverUrl

  const album: Album = {
    id: albumId,
    name: albumName,
    artist: track.artist || 'Unknown Artist',
    coverUrl: coverUrl,
    trackIds: [track.id],
  }

  return {
    track: { ...track, albumId },
    album,
  }
}
