// src/stores/player/playerHelpers.ts

import type { Track } from '@/types/track'

/**
 * Перемешивает массив (Fisher-Yates). Возвращает новый массив,
 * исходный не мутирует.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/**
 * Ищет первый не-дизлайкнутый трек в `tracks`, начиная с индекса `from`
 * (включительно), двигаясь вперёд. Возвращает индекс или -1.
 */
export function findNonDislikedIndexFrom(
  tracks: Track[],
  from: number,
  disliked: Set<string>,
): number {
  for (let i = from; i < tracks.length; i++) {
    const t = tracks[i]
    if (t && !disliked.has(t.id)) return i
  }
  return -1
}

/**
 * Ищет первый не-дизлайкнутый трек в очереди, начиная с индекса `from`,
 * двигаясь в направлении `dir` (+1 вперёд, -1 назад). Возвращает индекс или -1.
 */
export function findNonDislikedIndex(
  queue: Track[],
  from: number,
  dir: 1 | -1,
  disliked: Set<string>,
): number {
  for (let i = from; i >= 0 && i < queue.length; i += dir) {
    const track = queue[i]
    if (track && !disliked.has(track.id)) return i
  }
  return -1
}
