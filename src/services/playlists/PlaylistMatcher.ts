// src/services/playlists/PlaylistMatcher.ts

import { fuzzyMatch } from '@/utils/fuzzyMatch';
import { layoutVariants } from '@/utils/layout';
import type { Track } from '@/types/track';
import type { PlaylistExportTrack } from '@/types/collection';

export interface MatchResult<T = Track> {
  track: T | null;
  score: number;
}

function isStrictString(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function findBestMatch<T extends Track>(
  incoming: PlaylistExportTrack | Track,
  libraryTracks: T[],
  threshold = 0.8,
): MatchResult<T> {
  let bestTrack: T | null = null;
  let bestScore = 0;

  const incomingTitle = (incoming.title || '').trim().toLowerCase();
  const incomingArtist = (incoming.artist || '').trim().toLowerCase();

  if (!incomingTitle && !incomingArtist) {
    return { track: null, score: 0 };
  }

  for (const track of libraryTracks) {
    const libTitle = track.title.trim().toLowerCase();
    const libArtist = (track.artist || '').trim().toLowerCase();

    // 1. Строгое совпадение (мгновенный мёрж)
    if (isStrictString(incomingTitle, libTitle) && isStrictString(incomingArtist, libArtist)) {
      return { track, score: 1.0 };
    }

    const titleVariants = layoutVariants(incomingTitle);
    const artistVariants = layoutVariants(incomingArtist);

    let maxTitleScore = 0;
    for (const variant of titleVariants) {
      const score = fuzzyMatch(variant, libTitle);
      if (score > maxTitleScore) maxTitleScore = score;
    }

    let maxArtistScore = 0;
    if (incomingArtist) {
      for (const variant of artistVariants) {
        const score = fuzzyMatch(variant, libArtist);
        if (score > maxArtistScore) maxArtistScore = score;
      }
    }

    let finalScore = 0;

    const isArtistStrict = maxArtistScore >= 0.85;
    const isTitleStrict = maxTitleScore >= 0.95;

    if (incomingArtist && libArtist) {
      if (isArtistStrict) {
        if (isTitleStrict) {
          finalScore = maxTitleScore * 0.8 + maxArtistScore * 0.2;
        } else {
          // Артист совпал, но тайтл разный (Track 1 vs Track 2) -> это разные треки
          finalScore = maxTitleScore * 0.4;
        }
      } else {
        // Артисты не совпали. Если они очень похожи (например, опечатка в имени),
        // даем шанс только при почти идеальном тайтле.
        if (maxArtistScore >= 0.7 && maxTitleScore >= 0.95) {
          finalScore = 0.7 * maxTitleScore + 0.3 * maxArtistScore;
        } else {
          finalScore = maxTitleScore * 0.4;
        }
      }
    } else {
      // Один из артистов пуст (например, у радио).
      finalScore = maxTitleScore;
    }

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestTrack = track;
    }
  }

  if (bestScore >= threshold && bestTrack) {
    return { track: bestTrack, score: bestScore };
  }

  return { track: null, score: bestScore };
}
