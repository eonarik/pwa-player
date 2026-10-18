// server/src/settings/client.ts

import { yandexFetch, YandexApiError } from '../yandex/client.js'
import { normalizeClientPath } from '../disk/normalize.js'

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000 // 5 минут
const ERROR_CACHE_TTL_MS = 30 * 1000 // 30 секунд — короткий negative cache

/** Имя файла настроек в корне музыкальной папки. */
const SETTINGS_FILENAME = '.settings.json'

let cachedSettings = null
let cachedAt = 0

/**
 * Ошибка загрузки настроек. Пока не истёк её TTL —
 * loadSettings возвращает null, не пытаясь сходить к Яндексу.
 */
let cachedErrorAt = 0

/** Полный путь до .settings.json на Диске */
function getSettingsPath() {
  const root = process.env.YANDEX_MUSIC_PATH ?? '/'
  const normalizedRoot = root.startsWith('disk:') ? root.replace(/^disk:/, '') : root
  const cleanRoot = normalizedRoot.replace(/\/+$/, '')
  const rootWithSlash = cleanRoot === '' ? '' : cleanRoot
  return `disk:${rootWithSlash}/${SETTINGS_FILENAME}`
}

/**
 * Проверяет, указывает ли клиентский путь на файл .settings.json.
 * Используется в disk/routes.js, чтобы после PUT /text сбросить кэш настроек.
 */
export function isSettingsPath(clientPath) {
  const normalized = normalizeClientPath(clientPath)
  return normalized === SETTINGS_FILENAME
}

/**
 * Читает .settings.json с Яндекс.Диска.
 * Кэширует в памяти на 5 минут.
 * Если файла нет — возвращает null.
 *
 * При ошибке загрузки (сеть, 5xx) — negative cache 30 секунд,
 * чтобы не долбить API при недоступности.
 */
export async function loadSettings() {
  const now = Date.now()

  // 1. Свежий успешный кэш
  if (cachedSettings && now - cachedAt < SETTINGS_CACHE_TTL_MS) {
    return cachedSettings
  }

  // 2. Свежий negative cache — не ходим в API
  if (cachedErrorAt > 0 && now - cachedErrorAt < ERROR_CACHE_TTL_MS) {
    return null
  }

  const settingsPath = getSettingsPath()

  try {
    const metaResponse = await yandexFetch('/resources/download', {
      path: settingsPath,
    })
    const meta = await metaResponse.json()

    if (!meta.href) {
      cachedSettings = null
      cachedAt = now
      cachedErrorAt = 0
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
      cachedErrorAt = 0
      return null
    }

    const text = await fileResponse.text()
    const parsed = JSON.parse(text)

    cachedSettings = {
      password: typeof parsed.password === 'string' ? parsed.password : '',
      publicFolders: Array.isArray(parsed.publicFolders)
        ? parsed.publicFolders.filter((p) => typeof p === 'string')
        : [],
    }
    cachedAt = now
    cachedErrorAt = 0

    return cachedSettings
  } catch (err) {
    // 404 — файла нет, это не «ошибка», это валидный кейс
    if (err instanceof YandexApiError && err.status === 404) {
      cachedSettings = null
      cachedAt = now
      cachedErrorAt = 0
      return null
    }

    // Все остальные ошибки — negative cache
    console.error('[settings] failed to load .settings.json', err)
    cachedErrorAt = now
    return null
  }
}

export function invalidateSettingsCache() {
  cachedSettings = null
  cachedAt = 0
  cachedErrorAt = 0
}

/** Полный путь на Диске до корня музыки, например 'disk:/лежни' */
export function getMusicRootPath() {
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
 * - Путь внутри публичной папки → доступен.
 * - Путь — родитель публичной папки → тоже доступен (нужен для навигации к ней).
 *
 * Путь нормализуется: `..` и `.` схлопываются, из-за корня выйти нельзя.
 * Это закрывает обход вида `/nostalgy/../../../secret`.
 */
export function isPathPublic(path, publicFolders) {
  if (publicFolders.length === 0) return false

  if (publicFolders.some((p) => p === '/' || p === '')) return true

  const cleanPath = normalizeClientPath(path)

  return publicFolders.some((folder) => {
    const cleanFolder = normalizeClientPath(folder)
    if (cleanFolder === '') return true

    // 1. Путь внутри публичной папки (или сама папка)
    if (cleanPath === cleanFolder || cleanPath.startsWith(cleanFolder + '/')) return true

    // 2. Корень — родитель любой публичной папки
    if (cleanPath === '') return true

    // 3. Путь — родитель публичной папки
    if (cleanFolder.startsWith(cleanPath + '/')) return true

    return false
  })
}
