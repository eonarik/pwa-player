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

export function buildEntitiesForTrack(
  track: LibraryTrack,
  existingAlbum?: Album | null, // <-- ДОБАВЛЕНО
): EntityGraphResult {
  const albumName = track.album?.trim() || ''
  const albumId = createAlbumId(albumName, track.artist || '')

  if (!albumId) {
    return { track: { ...track, albumId: undefined }, album: null }
  }

  // Берем обложку: сначала из raw, потом из существующего альбома
  const coverUrl = track.raw?.coverUrl || existingAlbum?.coverUrl

  const album: Album = {
    id: albumId,
    name: albumName,
    artist: track.artist || 'Unknown Artist',
    coverUrl: coverUrl,
    trackIds: existingAlbum ? [...existingAlbum.trackIds] : [track.id],
  }

  if (!album.trackIds.includes(track.id)) {
    album.trackIds.push(track.id)
  }

  return {
    track: { ...track, albumId },
    album,
  }
}
