// src/types/history.ts

/**
 * Запись истории воспроизведения.
 * Снимок метаданных, чтобы история не ломалась при смене источника.
 */
export interface PlayHistoryEntry {
  /** Полный trackId в формате библиотеки: 'track:yandex:disk:/...' */
  trackId: string
  title: string
  artist: string
  album?: string
  /** Полный путь на Диске, если трек оттуда. Для скачивания из истории */
  remotePath?: string
  /** Когда последний раз воспроизводился (timestamp) */
  playedAt: number
}

/** Максимальный размер истории. Старые записи вытесняются новыми. */
export const HISTORY_MAX_SIZE = 1000
