// src/plugins/yandexDisk/download.ts

import type { PluginContext, DownloadTrackOptions, DownloadedTrackInfo } from '../types'
import type { LibraryTrack } from '@/types/library'
import { downloadUrlToFile } from '@/services/download/downloadUrlToFile'

export interface DownloadDeps {
  /** Функция, возвращающая URL для скачивания трека (buildDownloadUrl из LibrarySource) */
  buildDownloadUrl: (track: LibraryTrack) => string
}

/**
 * Скачивает трек в папку, указанную в `options.targetDir`.
 * Использует `buildDownloadUrl` для получения подписанной ссылки.
 *
 * Возвращает `{ relativePath, size, handle }` — путь внутри `targetDir`,
 * размер скачанного файла и его `FileSystemFileHandle` (для последующего
 * `writer.updateTrackHandle`).
 */
export async function downloadTrackToDir(
  deps: DownloadDeps,
  _context: PluginContext,
  track: LibraryTrack,
  options: DownloadTrackOptions,
): Promise<DownloadedTrackInfo> {
  const url = deps.buildDownloadUrl(track)
  const relativePath = track.path ?? track.filename
  const result = await downloadUrlToFile(url, {
    targetDir: options.targetDir,
    relativePath,
    onProgress: options.onProgress,
    signal: options.signal,
  })
  return { relativePath, size: result.size, handle: result.handle }
}

/**
 * Удаляет скачанный трек из папки. Тихий no-op, если файла нет.
 */
export async function removeDownloadedFromDir(
  _context: PluginContext,
  track: LibraryTrack,
  targetDir: FileSystemDirectoryHandle,
): Promise<void> {
  const relativePath = track.path ?? track.filename
  const segments = relativePath.split('/').filter(Boolean)
  const fileName = segments.pop()
  if (!fileName) return

  try {
    let dir = targetDir
    for (const seg of segments) dir = await dir.getDirectoryHandle(seg)
    await dir.removeEntry(fileName)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') return
    throw err
  }
}
