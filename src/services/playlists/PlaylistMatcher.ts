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
  libraryIndex: Map<string, T[]>,
  threshold = 0.8,
): MatchResult<T> {
  let bestTrack: T | null = null;
  let bestScore = 0;

  const incomingTitle = (incoming.title || '').trim().toLowerCase();
  const incomingArtist = (incoming.artist || '').trim().toLowerCase();

  if (!incomingTitle && !incomingArtist) {
    return { track: null, score: 0 };
  }

  const candidates = libraryIndex.get(incomingArtist) || [];

  if (candidates.length === 0) {
    return { track: null, score: 0 };
  }

  const titleVariants = layoutVariants(incomingTitle);
  const artistVariants = layoutVariants(incomingArtist);

  for (const track of candidates) {
    const libTitle = track.title.trim().toLowerCase();
    const libArtist = (track.artist || '').trim().toLowerCase();

    // Строгое совпадение
    if (isStrictString(incomingTitle, libTitle) && isStrictString(incomingArtist, libArtist)) {
      return { track, score: 1.0 };
    }

    let maxTitleScore = 0;
    for (const variant of titleVariants) {
      if (libTitle.includes(variant)) {
        maxTitleScore = 1;
        break;
      }
      const score = fuzzyMatch(variant, libTitle);
      if (score > maxTitleScore) maxTitleScore = score;
    }

    let maxArtistScore = 0;
    if (incomingArtist) {
      for (const variant of artistVariants) {
        if (libArtist.includes(variant)) {
          maxArtistScore = 1;
          break;
        }
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
          finalScore = maxTitleScore * 0.4;
        }
      } else {
        if (maxArtistScore >= 0.7 && maxTitleScore >= 0.95) {
          finalScore = 0.7 * maxTitleScore + 0.3 * maxArtistScore;
        } else {
          finalScore = maxTitleScore * 0.4;
        }
      }
    } else if (!incomingArtist && !libArtist) {
      // Если артистов нет, требуем строгого совпадения тайтла,
      // иначе любые "track1" и "track2" склеятся из-за высокого fuzzy score.
      finalScore = isTitleStrict ? maxTitleScore : 0;
    } else {
      finalScore = maxTitleScore * 0.5;
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
