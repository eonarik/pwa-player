// server/src/shared/yandexApi.js

import { YandexApiError } from './errors.js'

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk'

/**
 * Обёртка над fetch к API Яндекс.Диска.
 * Токен передаётся явно (из сессии), не из env.
 *
 * @param {string} accessToken — OAuth-токен пользователя
 * @param {string} endpoint — например, '/resources'
 * @param {Record<string, string|number>} [params]
 * @param {RequestInit} [init]
 */
export async function yandexFetch(accessToken, endpoint, params = {}, init = {}) {
  if (!accessToken) {
    throw new YandexApiError(401, 'No Yandex access token')
  }

  const url = new URL(`${YANDEX_API}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `OAuth ${accessToken}`,
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    let message = `Yandex API error: ${response.status}`
    try {
      const body = await response.json()
      message = body.message || body.description || message
    } catch {
      // ignore
    }
    throw new YandexApiError(response.status, message)
  }

  return response
}

/**
 * Метаданные ресурса (файл/папка).
 */
export async function yandexResourceMeta(accessToken, path) {
  const response = await yandexFetch(accessToken, '/resources', { path })
  return response.json()
}

/**
 * Список содержимого папки.
 */
export async function yandexListResources(accessToken, path, limit = 1000) {
  const response = await yandexFetch(accessToken, '/resources', {
    path,
    limit,
    sort: 'name',
  })
  return response.json()
}

/**
 * Ссылка на скачивание файла.
 */
export async function yandexDownloadHref(accessToken, path) {
  const response = await yandexFetch(accessToken, '/resources/download', { path })
  const meta = await response.json()
  return meta.href ?? null
}

/**
 * Загрузка файла (PUT по href из /resources/upload).
 */
export async function yandexUploadText(accessToken, path, content) {
  const response = await yandexFetch(accessToken, '/resources/upload', {
    path,
    overwrite: 'true',
  })
  const meta = await response.json()
  if (!meta.href) throw new YandexApiError(500, 'Upload URL not found')

  const put = await fetch(meta.href, {
    method: 'PUT',
    body: content,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
  if (!put.ok) {
    throw new YandexApiError(put.status, `Upload failed: HTTP ${put.status}`)
  }
  return true
}
