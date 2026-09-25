export interface FileEntry {
  handle: FileSystemFileHandle
  /** Хэндл директории, в которой лежит файл */
  directoryHandle: FileSystemDirectoryHandle
  file: File
  path: string
  name: string
  size: number
}

export type PermissionMode = 'read' | 'readwrite'
