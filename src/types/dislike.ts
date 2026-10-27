// src/types/dislike.ts

/**
 * Запись дизлайка.
 */
export interface DislikeEntry {
  /** ID трека в библиотеке */
  trackId: string
  dislikedAt: number
}
