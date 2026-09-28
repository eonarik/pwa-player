// src/types/track.ts

import type { TrackMetadata } from '@/services/metadata/types'

export interface Track extends TrackMetadata {
  id: string

  /** id плагина-источника: 'local', 'yandex', ... */
  pluginId: string

  /** URL стриминга или File для <audio> */
  source: string | File

  filename: string
  path?: string
  handle?: FileSystemFileHandle
  /** Хэндл директории — для восстановления обложек */
  directoryHandle?: FileSystemDirectoryHandle
}
