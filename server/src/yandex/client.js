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
