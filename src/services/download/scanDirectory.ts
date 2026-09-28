// src/services/download/scanDirectory.ts

export interface ScannedFile {
  handle: FileSystemFileHandle
  size: number
}

/**
 * Рекурсивно обходит папку и возвращает плоскую карту файлов.
 * Ключ — относительный путь от корня (например, 'Music/Album/01.mp3').
 *
 * Не читает содержимое файлов — только метаданные.
 */
export async function scanDirectory(
  dir: FileSystemDirectoryHandle,
  prefix = '',
): Promise<Map<string, ScannedFile>> {
  const result = new Map<string, ScannedFile>()

  for await (const entry of dir.values()) {
    if (entry.kind === 'file') {
      try {
        const file = await entry.getFile()
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        result.set(path, { handle: entry, size: file.size })
      } catch (err) {
        console.warn(`[scan] failed to read file "${entry.name}"`, err)
      }
    } else if (entry.kind === 'directory') {
      const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name
      const childResult = await scanDirectory(entry, childPrefix)
      for (const [k, v] of childResult) {
        result.set(k, v)
      }
    }
  }

  return result
}
