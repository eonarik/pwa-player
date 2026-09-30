// src/types/dislike.ts

/**
 * Запись дизлайка — снимок метаданных на момент дизлайка.
 * Позволяет показать в настройках, что именно пользователь дизлайкнул,
 * даже если трек больше недоступен в библиотеке.
 */
export interface DislikeEntry {
  trackId: string
  pluginId: string
  title: string
  artist: string
  album?: string
  remotePath?: string
  dislikedAt: number
}
