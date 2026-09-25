import type { TrackMetadata } from '@/services/metadata/types'

export interface Track extends TrackMetadata {
  id: string
  source: string | File
  filename: string
  path?: string
  handle?: FileSystemFileHandle
  /** Хэндл директории — для восстановления обложек */
  directoryHandle?: FileSystemDirectoryHandle
}
