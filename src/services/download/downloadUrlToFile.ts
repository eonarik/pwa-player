// src/services/download/downloadUrlToFile.ts

export interface DownloadUrlOptions {
  targetDir: FileSystemDirectoryHandle
  relativePath: string
  onProgress?: (written: number, total: number) => void
  signal?: AbortSignal
  /** Кастомный fetcher (например, для авторизации с рефрешем) */
  fetcher?: (url: string, options: RequestInit) => Promise<Response>
}

export interface DownloadUrlResult {
  size: number
  /** Хэндл скачанного файла. */
  handle: FileSystemFileHandle
}

export async function downloadUrlToFile(
  url: string,
  options: DownloadUrlOptions,
): Promise<DownloadUrlResult> {
  const { targetDir, relativePath, onProgress, signal, fetcher } = options

  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const doFetch = fetcher || fetch
  const response = await doFetch(url, { signal, credentials: 'include' })

  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status}`)
  }

  const totalFromHeader = Number(response.headers.get('Content-Length')) || 0

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
    return { size: written, handle: fileHandle }
  } catch (err) {
    await writable.abort().catch(() => {})
    try {
      await dir.removeEntry(fileName)
    } catch {
      // ignore
    }
    throw err
  }
}
