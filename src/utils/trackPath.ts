// src/utils/trackPath.ts

import { getPlugins, pluginIdFromSource } from '@/plugins/registry'
import { useLibraryStore } from '@/stores/library'
import type { Track } from '@/types/track'

const UNKNOWN_PLUGIN = '<unknown_source>'
const UNKNOWN_FOLDER = '<unknown_folder>'

const MAX_PATH_LENGTH = 30

/**
 * Формирует читаемый путь трека: `pluginName/folder1/folder2`.
 * Обрезает с начала, если длиннее MAX_PATH_LENGTH.
 *
 * Для треков без folderId (плейлисты, история) — `pluginName/<unknown_folder>`.
 */
export function getTrackPath(track: Track): string {
  const pluginId = track.pluginId
  if (!pluginId) return UNKNOWN_FOLDER

  const pluginName = getPluginName(pluginId)

  const folderId = (track as { folderId?: string }).folderId
  if (!folderId) return `${pluginName}/${UNKNOWN_FOLDER}`

  const library = useLibraryStore()
  const folder = library.getFolder(folderId)
  if (!folder || !folder.path) return `${pluginName}/${UNKNOWN_FOLDER}`

  const fullPath = `${pluginName}/${folder.path}`
  return truncatePath(fullPath)
}

function getPluginName(pluginId: string): string {
  const plugin = getPlugins().find((p) => p.id === pluginIdFromSource(pluginId))
  return plugin?.name ?? UNKNOWN_PLUGIN
}

function truncatePath(path: string): string {
  if (path.length <= MAX_PATH_LENGTH) return path
  return '...' + path.slice(-(MAX_PATH_LENGTH - 3))
}
