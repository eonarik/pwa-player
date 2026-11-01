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

  // 1. Быстрый поиск по индексу артистов
  // Ищем точное совпадение артиста (в нижнем регистре)
  const candidates = libraryIndex.get(incomingArtist) || [];

  // Если точного нет, ищем по частичному совпадению (например, feat. или другие варианты)
  // Но чтобы не перебирать всё, мы можем поискать по первой букве или по словам,
  // либо просто fallback на всех, если индекс пуст (для случая, когда входящий артист не совпадает).
  // Для простоты и скорости, пока ограничимся точным совпадением артиста.
  if (candidates.length === 0) {
    // Fallback: если не нашли по точному артисту, берем всех (медленно, но это крайний случай)
    // В идеале тут нужно реализовать нечеткий поиск по артистам.
    // Пока возвращаем пустой результат, чтобы не фризить на 10k треков.
    return { track: null, score: 0 };
  }

  const titleVariants = layoutVariants(incomingTitle);
  const artistVariants = layoutVariants(incomingArtist);

  // 2. Перебираем только кандидатов этого артиста
  for (const track of candidates) {
    const libTitle = track.title.trim().toLowerCase();
    const libArtist = (track.artist || '').trim().toLowerCase();

    // Строгое совпадение
    if (isStrictString(incomingTitle, libTitle) && isStrictString(incomingArtist, libArtist)) {
      return { track, score: 1.0 };
    }

    let maxTitleScore = 0;
    // Сначала быстрая проверка на вхождение
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
      finalScore = maxTitleScore;
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
