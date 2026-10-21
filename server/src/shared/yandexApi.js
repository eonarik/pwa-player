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
 * Метаданные ресурса (файл/папка).
 */
export async function yandexResourceMeta(accessToken, path) {
  const response = await yandexFetch(accessToken, '/resources', { path })
  return response.json()
}

/**
 * Определяет кодировку буфера и декодирует в строку.
 */
function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer)

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // не UTF-8
  }

  try {
    return new TextDecoder('windows-1251').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/**
 * Скачивает текстовое содержимое файла с Диска.
 */
export async function yandexDownloadText(accessToken, path) {
  const metaResponse = await yandexFetch(accessToken, '/resources/download', { path })
  const meta = await metaResponse.json()
  if (!meta.href) return null

  // Убираем заголовок Authorization, так как ссылка уже подписана
  const fileResponse = await fetch(meta.href)

  if (!fileResponse.ok) return null

  const arrayBuffer = await fileResponse.arrayBuffer()
  return decodeBuffer(arrayBuffer)
}

/**
 * Загружает текст в файл на Диске.
 */
export async function yandexUploadText(accessToken, path, content) {
  const uploadResponse = await yandexFetch(accessToken, '/resources/upload', {
    path,
    overwrite: 'true',
  })
  const uploadMeta = await uploadResponse.json()
  if (!uploadMeta.href) {
    throw new Error('Upload URL not found')
  }

  const putResponse = await fetch(uploadMeta.href, {
    method: 'PUT',
    body: content,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })

  if (!putResponse.ok) {
    throw new Error(`Upload failed: HTTP ${putResponse.status}`)
  }

  return true
}
