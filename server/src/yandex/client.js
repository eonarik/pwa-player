// server/src/yandex/client.js

const YANDEX_API = 'https://cloud-api.yandex.net/v1/disk'

export class YandexApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'YandexApiError'
    this.status = status
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

// --- Текстовые файлы -------------------------------------------------

/**
 * Определяет кодировку буфера и декодирует в строку.
 *
 * Порядок:
 * 1. BOM (UTF-8 / UTF-16LE / UTF-16BE) — если есть.
 * 2. UTF-8 (fatal: true) — если байты валидны как UTF-8.
 * 3. Windows-1251 — fallback.
 */
function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer)

  // 1. BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }

  // 2. UTF-8 (fatal)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // не UTF-8
  }

  // 3. Windows-1251
  try {
    return new TextDecoder('windows-1251').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/**
 * Скачивает текстовое содержимое файла с Диска.
 * Возвращает строку или null, если файла нет.
 * Автоопределяет кодировку (UTF-8 / UTF-16 / Windows-1251).
 */
export async function yandexDownloadText(path) {
  const metaResponse = await yandexFetch('/resources/download', { path })
  const meta = await metaResponse.json()
  if (!meta.href) return null

  const fileResponse = await fetch(meta.href, {
    headers: { Authorization: `OAuth ${getToken()}` },
  })
  if (!fileResponse.ok) return null

  const arrayBuffer = await fileResponse.arrayBuffer()
  return decodeBuffer(arrayBuffer)
}

/**
 * Загружает текст в файл на Диске.
 * Всегда сохраняет в UTF-8.
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
