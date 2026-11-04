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
      // Симметричное substring-совпадение (одна строка содержит другую).
      if (libTitle.includes(variant) || variant.includes(libTitle)) {
        maxTitleScore = 1;
        break;
      }
      // Jaro-Winkler асимметричен: короткая строка первой даёт больший score.
      const [short, long] = variant.length <= libTitle.length ? [variant, libTitle] : [libTitle, variant];
      const score = fuzzyMatch(short, long);
      if (score > maxTitleScore) maxTitleScore = score;
    }

    let maxArtistScore = 0;
    if (incomingArtist) {
      for (const variant of artistVariants) {
        if (libArtist.includes(variant) || variant.includes(libArtist)) {
          maxArtistScore = 1;
          break;
        }
        const [short, long] = variant.length <= libArtist.length ? [variant, libArtist] : [libArtist, variant];
        const score = fuzzyMatch(short, long);
        if (score > maxArtistScore) maxArtistScore = score;
      }
    }

    let finalScore = 0;

    const isArtistStrict = maxArtistScore >= 0.85;
    const isTitleStrict = maxTitleScore >= 0.95;

    if (incomingArtist && libArtist) {
      if (isArtistStrict) {
        // Artist строгий: title с любым fuzzy — 0.8 * title + 0.2 * artist.
        // Если title не строгий — всё равно высокий score, но merge отправит в candidates.
        finalScore = maxTitleScore * 0.8 + maxArtistScore * 0.2;
      } else {
        if (maxArtistScore >= 0.7 && maxTitleScore >= 0.95) {
          finalScore = 0.7 * maxTitleScore + 0.3 * maxArtistScore;
        } else {
          finalScore = maxTitleScore * 0.4;
        }
      }
    } else if (!incomingArtist && !libArtist) {
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
