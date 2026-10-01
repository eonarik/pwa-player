// server/src/yandex/client.ts

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk'

export class YandexApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'YandexApiError'
  }
}

function getToken() {
  const token = process.env.YANDEX_TOKEN
  if (!token) {
    throw new Error('YANDEX_TOKEN is not set')
  }
  return token
}

/**
 * Обёртка над fetch к API Яндекс.Диска.
 * Добавляет OAuth-токен и обрабатывает ошибки.
 */
export async function yandexFetch(endpoint, params = {}) {
  const url = new URL(`${YANDEX_API}${endpoint}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `OAuth ${getToken()}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    // Пробуем прочитать тело ошибки от Яндекса
    let message = `Yandex API error: ${response.status}`
    try {
      const body = await response.json()
      message = body.message || body.description || message
    } catch {
      // ignore parse errors
    }
    throw new YandexApiError(response.status, message)
  }

  return response
}

/**
 * Скачивает текстовое содержимое файла с Диска.
 * Возвращает строку или null, если файла нет.
 */
export async function yandexDownloadText(path) {
  const metaResponse = await yandexFetch('/resources/download', { path })
  const meta = await metaResponse.json()
  if (!meta.href) return null

  const fileResponse = await fetch(meta.href, {
    headers: { Authorization: `OAuth ${getToken()}` },
  })
  if (!fileResponse.ok) return null

  return fileResponse.text()
}

/**
 * Загружает текст в файл на Диске.
 * Перезаписывает существующий файл.
 */
export async function yandexUploadText(path, content) {
  const uploadResponse = await yandexFetch('/resources/upload', {
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

/** Возвращает метаданные файла (для modified / size). */
export async function yandexFileMeta(path) {
  const response = await yandexFetch('/resources', { path })
  return response.json()
}
