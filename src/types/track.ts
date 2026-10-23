// src/types/track.ts

import type { TrackMetadata } from '@/services/metadata/types'

export interface Track extends TrackMetadata {
  id: string

  /** id плагина-источника: 'local', 'yandex', ... */
  pluginId: string

  /**
   * URL для стриминга. Для локальных копий (`fileLocation: 'local-only' | 'both'`)
   * — пустая строка. File резолвится из `handle` через `resolveTrackSource`.
   */
  source: string

  /**
   * Хэндл файла для локальных копий (`fileLocation: 'local-only' | 'both'`).
   * Единственный источник правды для локального файла.
   */
  handle?: FileSystemFileHandle

  filename: string
  path?: string
  /** Хэндл директории — для восстановления обложек. */
  directoryHandle?: FileSystemDirectoryHandle
}
