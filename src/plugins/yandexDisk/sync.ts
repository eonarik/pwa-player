// src/plugins/yandexDisk/sync.ts

import type { PluginContext, ScanResult } from '../types'
import type { LibraryTrack } from '@/types/library'
import { scanDirectory } from '@/services/download/scanDirectory'
import { getFileFromPath } from '@/services/download/getFileFromPath'
import { parseTrackMetadata } from '@/services/metadata/parseTrackMetadata'
import { trackIdFromPath } from '@/services/library/id'
import { findNearestFolder } from './scan'

export interface SyncDeps {
  /** id плагина (для нормализации source и поиска треков) */
  sourceId: string
}

/**
 * Сканирует папку скачивания и сопоставляет файлы с треками источника.
 *
 * Возвращает:
 * - `downloaded` — Map<trackId, relativePath> для треков, чьи файлы найдены.
 * - `onlyLocal` — файлы на диске, которых нет в библиотеке (новые).
 * - `missing` — треки с origin === 'downloaded', чьих файлов нет.
 */
export async function scanDownloadDirForSource(
  deps: SyncDeps,
  context: PluginContext,
  targetDir: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const files = await scanDirectory(targetDir)
  const allTracks = context.writer.getTracksBySource(deps.sourceId)

  const byPath = new Map<string, LibraryTrack>()
  for (const track of allTracks) {
    byPath.set(track.path ?? track.filename, track)
  }

  const downloaded = new Map<string, string>()
  const matchedPaths = new Set<string>()

  for (const filePath of files.keys()) {
    const track = byPath.get(filePath)
    if (track) {
      downloaded.set(track.id, filePath)
      matchedPaths.add(filePath)
    }
  }

  const onlyLocal: Array<{ relativePath: string; filename: string }> = []
  for (const [filePath, file] of files) {
    if (matchedPaths.has(filePath)) continue
    onlyLocal.push({ relativePath: filePath, filename: file.handle.name })
  }

  const missing: string[] = []
  for (const track of allTracks) {
    if (track.origin !== 'downloaded') continue
    if (!files.has(track.path ?? track.filename)) missing.push(track.id)
  }

  return { downloaded, onlyLocal, missing }
}

/**
 * Создаёт LibraryTrack из файла, найденного в папке скачивания,
 * но отсутствующего в библиотеке. Используется для `onlyLocal`
 * после того, как пользователь подтвердил добавление.
 *
 * Возвращает null, если файл не найден или папка-владелец не определена.
 */
export async function createLocalTrackFromFile(
  deps: SyncDeps,
  context: PluginContext,
  relativePath: string,
  filename: string,
): Promise<LibraryTrack | null> {
  const trackId = trackIdFromPath(deps.sourceId, relativePath)
  if (context.writer.getTrack(trackId)) return null

  const targetDir = await context.getDownloadDir()
  if (!targetDir) return null

  const file = await getFileFromPath(targetDir, relativePath)
  if (!file) return null

  const folder = findNearestFolder(context.writer, deps.sourceId, relativePath)
  if (!folder) return null

  const metadata = await parseTrackMetadata(file, {
    folderName: relativePath.split('/').slice(-2)[0],
  })

  return {
    id: trackId,
    pluginId: deps.sourceId,
    folderId: folder.id,
    filename,
    path: relativePath,
    source: file,
    origin: 'only-local',
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    duration: metadata.duration,
    coverUrl: metadata.coverUrl,
  }
}
