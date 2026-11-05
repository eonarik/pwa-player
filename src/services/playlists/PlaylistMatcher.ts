// src/services/playlists/PlaylistMatcher.ts

import type { Track } from '@/types/track';
import type { PlaylistExportTrack } from '@/types/collection';

export interface MatchResult<T = Track> {
  track: T | null;
  score: number;
}

/**
 * Нормализация строки для сравнения:
 * - Unicode NFC (чтобы "й" как одна точка == "й" как "и" + бревис);
 * - trim;
 * - lowercase;
 * - схлопывание множественных пробелов в один.
 *
 * Используется для artist и title в PlaylistMatcher и TrackMerger/utils.
 */
export function normalizeMatchString(value: string | null | undefined): string {
  return (value || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

const SCORE_STRICT = 1.0;
const SCORE_SOFT = 0.9;

/**
 * Ищет лучшее совпадение incoming в libraryIndex.
 *
 * Правила (по требованию пользователя):
 * 1. artist !== artist → null (score 0).
 * 2. artist === artist && title === title → strict (score 1.0).
 * 3. artist === artist && (title1 — подстрока title2, или наоборот) → soft (score 0.9).
 * 4. artist === artist && title !== title && не подстрока → null (score 0).
 *
 * `threshold` сохранён в сигнатуре для обратной совместимости вызывающего кода.
 * Все возвращаемые score уже "прошли" threshold, если track !== null.
 *
 * Если среди нескольких soft-кандидатов есть strict — strict побеждает
 * (не может быть нескольких strict с одинаковым artist+title, но на всякий случай).
 */
export function findBestMatch<T extends Track>(
  incoming: PlaylistExportTrack | Track,
  libraryIndex: Map<string, T[]>,
  threshold = 0.75,
): MatchResult<T> {
  void threshold;

  const incomingArtist = normalizeMatchString(incoming.artist);
  const incomingTitle = normalizeMatchString(incoming.title);

  // Если нет артиста или тайтла — не склеиваем (created).
  if (!incomingArtist || !incomingTitle) {
    return { track: null, score: 0 };
  }

  const candidates = libraryIndex.get(incomingArtist);
  if (!candidates || candidates.length === 0) {
    return { track: null, score: 0 };
  }

  let bestSoft: { track: T; score: number } | null = null;

  for (const candidate of candidates) {
    const candidateTitle = normalizeMatchString(candidate.title);

    if (candidateTitle === incomingTitle) {
      return { track: candidate, score: SCORE_STRICT };
    }

    if (candidateTitle.length > 0 && incomingTitle.length > 0) {
      if (candidateTitle.includes(incomingTitle) || incomingTitle.includes(candidateTitle)) {
        if (!bestSoft) {
          bestSoft = { track: candidate, score: SCORE_SOFT };
        }
      }
    }
  }

  if (bestSoft) return bestSoft;
  return { track: null, score: 0 };
}
