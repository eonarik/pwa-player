// server/src/settings/client.ts

import { yandexFetch, YandexApiError } from '../yandex/client.js'

export interface DiskSettings {
  password: string
  /** Пути относительно YANDEX_MUSIC_PATH. Пример: ['/Логии', '/Public'] */
  publicFolders: string[]
}

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут

let cachedSettings: DiskSettings | null = null
let cachedAt = 0

/** Полный путь до .settings.json на Диске */
function getSettingsPath(): string {
  const root = process.env.YANDEX_MUSIC_PATH ?? '/'
  const normalizedRoot = root.startsWith('disk:') ? root.replace(/^disk:/, '') : root
  const cleanRoot = normalizedRoot.replace(/\/+$/, '') // без хвостового /
  const rootWithSlash = cleanRoot === '' ? '' : cleanRoot
  return `disk:${rootWithSlash}/.settings.json`
}

/**
 * Читает .settings.json с Яндекс.Диска.
 * Кэширует в памяти на 5 минут.
 * Если файла нет — возвращает null.
 */
export async function loadSettings(): Promise<DiskSettings | null> {
  const now = Date.now()
  if (cachedSettings && now - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings
  }

  const settingsPath = getSettingsPath()

  try {
    const metaResponse = await yandexFetch('/resources/download', {
      path: settingsPath,
    })
    const meta = (await metaResponse.json()) as { href?: string }

    if (!meta.href) {
      cachedSettings = null
      cachedAt = now
      return null
    }

    const fileResponse = await fetch(meta.href, {
      headers: {
        Authorization: `OAuth ${process.env.YANDEX_TOKEN}`,
      },
    })

    if (!fileResponse.ok) {
      cachedSettings = null
      cachedAt = now
      return null
    }

    const text = await fileResponse.text()
    const parsed = JSON.parse(text) as Partial<DiskSettings>

    cachedSettings = {
      password: typeof parsed.password === 'string' ? parsed.password : '',
      publicFolders: Array.isArray(parsed.publicFolders)
        ? parsed.publicFolders.filter((p): p is string => typeof p === 'string')
        : [],
    }
    cachedAt = now

    return cachedSettings
  } catch (err) {
    if (err instanceof YandexApiError && err.status === 404) {
      cachedSettings = null
      cachedAt = now
      return null
    }
    console.error('[settings] failed to load .settings.json', err)
    return null
  }
}

export function invalidateSettingsCache(): void {
  cachedSettings = null
  cachedAt = 0
}

/** Полный путь на Диске до корня музыки, например 'disk:/лежни' */
export function getMusicRootPath(): string {
  const root = process.env.YANDEX_MUSIC_PATH ?? '/'
  const normalized = root.startsWith('disk:') ? root : `disk:${root}`
  // Убираем хвостовой слэш, если он не корень
  return normalized.replace(/\/+$/, '') || 'disk:/'
}

/**
 * Проверяет, доступен ли путь без авторизации.
 *
 * path — то, что пришло в query (обычно '/Логии/LoGii3026' или '/Логии/LoGii3026/track.mp3').
 * publicFolders — пути относительно YANDEX_MUSIC_PATH.
 *
 * Логика:
 * - '' в publicFolders или '/' → всё публично.
 * - Иначе — путь должен начинаться с одного из publicFolders.
 */
export function isPathPublic(path: string, publicFolders: string[]): boolean {
  if (publicFolders.length === 0) return false

  // Короткое замыкание: если есть '/' или '' — всё публично
  if (publicFolders.some((p) => p === '/' || p === '')) return true

  // Нормализуем запрошенный путь: убираем 'disk:' префикс, если есть
  const cleanPath = path.replace(/^disk:/, '').replace(/\/+$/, '')

  return publicFolders.some((folder) => {
    const cleanFolder = folder.replace(/^disk:/, '').replace(/\/+$/, '')
    // '' не должен сюда попасть, но на всякий
    if (cleanFolder === '') return true
    return cleanPath === cleanFolder || cleanPath.startsWith(cleanFolder + '/')
  })
}
