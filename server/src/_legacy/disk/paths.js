// server/src/disk/paths.ts

import { getMusicRootPath } from '../settings/client.js'
import { normalizeClientPath } from './normalize.js'

/**
 * Преобразует клиентский путь (относительно корня музыки) в полный путь на Яндекс.Диске.
 * Нормализует `.` и `..` — ведущие `..` игнорируются, попытка выйти за корень невозможна.
 */
export function resolveDiskPath(clientPath) {
  const root = getMusicRootPath()
  const clean = normalizeClientPath(clientPath)
  if (clean === '') return root
  return `${root}/${clean}`
}

/**
 * Преобразует полный путь на Яндекс.Диске в клиентский (относительный).
 * Если путь не внутри корня — возвращает как есть.
 */
export function toClientPath(diskPath) {
  const root = getMusicRootPath()
  if (diskPath === root) return '/'
  if (diskPath.startsWith(root + '/')) {
    return diskPath.slice(root.length)
  }
  return diskPath
}
