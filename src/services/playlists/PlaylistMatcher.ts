// src/services/playlists/PlaylistMatcher.ts

import { fuzzyMatch } from '@/utils/fuzzyMatch'
import { layoutVariants } from '@/utils/layout'
import type { LibraryTrack } from '@/types/library'
import type { PlaylistExportTrack } from '@/types/playlist'

export interface MatchResult {
  track: LibraryTrack | null
  score: number
}

export function findBestMatch(
  incoming: PlaylistExportTrack,
  libraryTracks: LibraryTrack[],
  threshold = 0.8,
): MatchResult {
  let bestTrack: LibraryTrack | null = null
  let bestScore = 0

  const incomingTitle = (incoming.title || '').toLowerCase().trim()
  const incomingArtist = (incoming.artist || '').toLowerCase().trim()

  // Если нет ни названия, ни артиста — совпадение невозможно
  if (!incomingTitle && !incomingArtist) {
    return { track: null, score: 0 }
  }

  for (const track of libraryTracks) {
    const libTitle = track.title.toLowerCase().trim()
    const libArtist = (track.artist || '').toLowerCase().trim()

    // Используем layoutVariants, чтобы сравнивать "слот" и "slot"
    const titleVariants = layoutVariants(incomingTitle)
    const artistVariants = layoutVariants(incomingArtist)

    let maxTitleScore = 0
    for (const variant of titleVariants) {
      const score = fuzzyMatch(variant, libTitle)
      if (score > maxTitleScore) maxTitleScore = score
    }

    let maxArtistScore = 0
    if (incomingArtist) {
      for (const variant of artistVariants) {
        const score = fuzzyMatch(variant, libArtist)
        if (score > maxArtistScore) maxArtistScore = score
      }
    }

    // Если артист явно не совпал, штрафуем (как в metadataSimilarity)
    let finalScore = 0
    if (maxArtistScore < 0.5 && incomingArtist && libArtist) {
      // Разные артисты — сильно снижаем шанс
      finalScore = maxTitleScore * 0.5
    } else {
      // Взвешенная сумма (title важнее)
      finalScore = incomingArtist ? maxTitleScore * 0.8 + maxArtistScore * 0.2 : maxTitleScore
    }

    if (finalScore > bestScore) {
      bestScore = finalScore
      bestTrack = track
    }
  }

  if (bestScore >= threshold && bestTrack) {
    return { track: bestTrack, score: bestScore }
  }

  return { track: null, score: bestScore }
}
