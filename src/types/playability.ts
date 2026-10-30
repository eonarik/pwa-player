// src/types/playability.ts

/**
 * Можно ли воспроизвести трек прямо сейчас.
 *
 * Вычисляется из Track.sources. Не хранится в Track.
 */
export type Playability =
  /** Есть хотя бы один local-source с handle. */
  | 'playable'
  /** Есть cloud-source, сессия плагина жива. */
  | 'playable-streaming'
  /** Есть cloud-source, но сессия истекла. Нужен reconnect. */
  | 'needs-reconnect'
  /** Идёт скачивание. */
  | 'downloading'
  /** Нет ни одного источника. */
  | 'missing';
