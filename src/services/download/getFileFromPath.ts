// src/services/download/getFileFromPath.ts

/**
 * Достаёт File из папки по относительному пути.
 * Возвращает null, если файла нет.
 */
export async function getFileFromPath(
  targetDir: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) return null

  try {
    let dir: FileSystemDirectoryHandle = targetDir
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg)
    }
    const fileHandle = await dir.getFileHandle(fileName)
    return await fileHandle.getFile()
  } catch {
    return null
  }
}
