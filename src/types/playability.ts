// src/types/playability.ts

/**
 * Можно ли воспроизвести трек прямо сейчас.
 *
 * Вычисляется из `fileLocation` + `source` + `plugin.isDisconnected`,
 * не хранится в `track`. См. `getPlayability`.
 */
export type Playability =
  /** Файл на устройстве, `source` — File. */
  | 'playable'
  /** В облаке, сессия жива, `source` — URL. */
  | 'playable-streaming'
  /** В облаке, но сессия истекла. Нужен reconnect. */
  | 'needs-reconnect'
  /** Локальный трек, но `source` не File (битое состояние). */
  | 'unavailable'
  /** Идёт скачивание — пока не играется. */
  | 'downloading'
  /** Трек-призрак: нет ни в облаке, ни локально. */
  | 'missing'
