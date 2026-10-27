// src/types/history.ts

/**
 * Запись истории воспроизведения.
 */
export interface PlayHistoryEntry {
  /** ID трека в библиотеке */
  trackId: string
  /** Когда последний раз воспроизводился (timestamp) */
  playedAt: number
}

/** Максимальный размер истории. Старые записи вытесняются новыми. */
export const HISTORY_MAX_SIZE = 1000
