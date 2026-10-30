// src/stores/player/playerHelpers.ts

import type { Track } from '@/types/track';

/**
 * Перемешивает массив (Fisher-Yates). Возвращает новый массив,
 * исходный не мутирует.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Ищет первый трек в `tracks`, начиная с индекса `from`, который
 * НЕ должен быть пропущен.
 *
 * `shouldSkip` — единый предикат: дизлайки, недоступность и любые
 * будущие причины скипа композируются в одном месте.
 */
export function findFirstPlayableIndex(tracks: Track[], from: number, shouldSkip: (track: Track) => boolean): number {
  for (let i = from; i < tracks.length; i++) {
    const t = tracks[i];
    if (t && !shouldSkip(t)) return i;
  }
  return -1;
}

/**
 * Ищет первый трек в очереди, начиная с индекса `from`, двигаясь
 * в направлении `dir` (+1 вперёд, -1 назад), который НЕ должен быть
 * пропущен.
 */
export function findPlayableIndex(
  queue: Track[],
  from: number,
  dir: 1 | -1,
  shouldSkip: (track: Track) => boolean,
): number {
  for (let i = from; i >= 0 && i < queue.length; i += dir) {
    const track = queue[i];
    if (track && !shouldSkip(track)) return i;
  }
  return -1;
}
