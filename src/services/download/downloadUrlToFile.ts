// src/services/download/downloadUrlToFile.ts

export interface DownloadUrlOptions {
  targetDir: FileSystemDirectoryHandle
  /** Относительный путь внутри targetDir: 'Music/Album/01.mp3' */
  relativePath: string
  onProgress?: (written: number, total: number) => void
  signal?: AbortSignal
}

export interface DownloadUrlResult {
  size: number
}

/**
 * Скачивает URL и записывает в файл внутри targetDir.
 *
 * Создаёт промежуточные папки по пути. Перезаписывает существующий файл
 * (create: true). Прогресс — по Content-Length, если он есть, иначе
 * total = 0.
 *
 * При отмене (signal.aborted) — прерывает запись и удаляет недописанный файл.
 */
export async function downloadUrlToFile(
  url: string,
  options: DownloadUrlOptions,
): Promise<DownloadUrlResult> {
  const { targetDir, relativePath, onProgress, signal } = options

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const response = await fetch(url, { signal })
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }

  const totalFromHeader = Number(response.headers.get('Content-Length')) || 0

  // Разбиваем путь на сегменты, создаём папки
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) {
    throw new Error(`Invalid relativePath: "${relativePath}"`)
  }

  let dir: FileSystemDirectoryHandle = targetDir
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: true })
  }

  const fileHandle = await dir.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()

  let written = 0
  try {
    const reader = response.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      written += value.byteLength
      onProgress?.(written, totalFromHeader)
    }
    await writable.close()
    return { size: written }
  } catch (err) {
    await writable.abort().catch(() => {})
    // Пытаемся удалить недописанный файл
    try {
      await dir.removeEntry(fileName)
    } catch {
      // ignore
    }
    throw err
  }
}
