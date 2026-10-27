// src/types/dislike.ts

import type { TrackSnapshot } from './snapshot'

/**
 * Запись дизлайка — снимок метаданных на момент дизлайка.
 * Позволяет показать в настройках, что именно пользователь дизлайкнул,
 * даже если трек больше недоступен в библиотеке.
 */
export interface DislikeEntry extends TrackSnapshot {
  dislikedAt: number
}
