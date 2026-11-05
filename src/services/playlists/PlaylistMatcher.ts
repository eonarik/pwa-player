// src/services/playlists/PlaylistMatcher.ts

import type { Track } from '@/types/track';
import type { PlaylistExportTrack } from '@/types/collection';

export interface MatchResult<T = Track> {
  track: T | null;
  score: number;
}

/**
 * Таблица диакритики для схлопывания.
 *
 * ВАЖНО:
 * - "ё" схлопывается в "е" (частая проблема в русских тегах).
 * - "й" НЕ схлопывается (это отдельная буква русского алфавита).
 * - Латинские диакритики: é → e, ä → a, ñ → n, ß → ss и т.д.
 */
const DIACRITICS_MAP: Record<string, string> = {
  // Русские (кроме й)
  ё: 'е',

  // Латинские
  à: 'a',
  á: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  å: 'a',
  è: 'e',
  é: 'e',
  ê: 'e',
  ë: 'e',
  ì: 'i',
  í: 'i',
  î: 'i',
  ï: 'i',
  ò: 'o',
  ó: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ù: 'u',
  ú: 'u',
  û: 'u',
  ü: 'u',
  ñ: 'n',
  ç: 'c',
  ý: 'y',
  ÿ: 'y',
  ß: 'ss',
};

function stripDiacritics(value: string): string {
  return Array.from(value)
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = DIACRITICS_MAP[lower];
      if (mapped === undefined) return char;
      return char === lower ? mapped : mapped.toUpperCase();
    })
    .join('');
}

/**
 * Нормализация строки для сравнения:
 * - Unicode NFC (чтобы "й" как одна точка == "й" как "и" + бревис);
 * - trim;
 * - lowercase;
 * - схлопывание множественных пробелов;
 * - схлопывание диакритики (ё → е, é → e, ä → a, ...), НО без й → и.
 *
 * Используется в PlaylistMatcher и TrackMerger/utils.
 */
export function normalizeMatchString(value: string | null | undefined): string {
  const base = (value || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  return stripDiacritics(base);
}

const SCORE_STRICT = 1.0;
const SCORE_SOFT = 0.9;

/**
 * Ищет лучшее совпадение incoming в libraryIndex.
 *
 * Правила:
 * 1. artist !== artist → null (score 0).
 * 2. artist === artist && title === title → strict (score 1.0).
 * 3. artist === artist && (title1 — подстрока title2, или наоборот) → soft (score 0.9).
 * 4. artist === artist && title !== title && не подстрока → null (score 0).
 *
 * `threshold` сохранён в сигнатуре для обратной совместимости.
 * Все возвращаемые score уже "прошли" threshold, если track !== null.
 */
export function findBestMatch<T extends Track>(
  incoming: PlaylistExportTrack | Track,
  libraryIndex: Map<string, T[]>,
  threshold = 0.75,
): MatchResult<T> {
  void threshold;

  const incomingArtist = normalizeMatchString(incoming.artist);
  const incomingTitle = normalizeMatchString(incoming.title);

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
