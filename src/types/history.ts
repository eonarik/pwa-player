// src/types/history.ts

import type { TrackSnapshot } from './snapshot'

/**
 * Запись истории воспроизведения.
 * Снимок метаданных, чтобы история не ломалась при смене источника.
 */
export interface PlayHistoryEntry extends TrackSnapshot {
  /** Когда последний раз воспроизводился (timestamp) */
  playedAt: number
}

/** Максимальный размер истории. Старые записи вытесняются новыми. */
export const HISTORY_MAX_SIZE = 1000
