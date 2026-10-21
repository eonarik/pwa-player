// server/src/plugins/yandex/service.js

import {
  yandexListResources,
  yandexDownloadHref,
  yandexResourceMeta,
  yandexUploadText,
} from '../../shared/yandexApi.js'
import { normalizeClientPath } from '../../shared/paths.js'
import { isAudioFile } from '../../shared/audio.js'

const APP_ROOT = 'app:/'

/**
 * Преобразует клиентский путь (относительно app:/) в полный путь на Диске.
 * Нормализует `.` и `..` — выйти за пределы app:/ невозможно.
 */
export function resolveDiskPath(clientPath) {
  const clean = normalizeClientPath(clientPath)
  if (clean === '') return APP_ROOT
  return `${APP_ROOT}${clean}`
}

/**
 * Преобразует полный путь на Диске в клиентский (относительно app:/).
 * Если путь не внутри app:/ — возвращает как есть.
 */
export function toClientPath(diskPath) {
  if (diskPath === APP_ROOT) return '/'
  if (diskPath.startsWith(APP_ROOT)) {
    return diskPath.slice(APP_ROOT.length - 1)
  }
  return diskPath
}

export { isAudioFile }

export async function listResources(accessToken, clientPath) {
  const path = resolveDiskPath(clientPath)
  const data = await yandexListResources(accessToken, path)

  const items = (data._embedded?.items ?? []).map((item) => ({
    ...item,
    path: toClientPath(item.path),
    isAudio: item.type === 'file' && isAudioFile(item.name),
  }))

  return { path: clientPath, total: items.length, items }
}

export async function getDownloadHref(accessToken, clientPath) {
  const path = resolveDiskPath(clientPath)
  return yandexDownloadHref(accessToken, path)
}

export async function getFileMeta(accessToken, clientPath) {
  const path = resolveDiskPath(clientPath)
  return yandexResourceMeta(accessToken, path)
}

export async function uploadText(accessToken, clientPath, content) {
  const path = resolveDiskPath(clientPath)
  await yandexUploadText(accessToken, path, content)
  return getFileMeta(accessToken, clientPath)
}
