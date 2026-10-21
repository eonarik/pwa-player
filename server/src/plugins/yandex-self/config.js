// server/src/plugins/yandex-self/config.js
import { yandexFetch } from '../../shared/yandexApi.js'

let cachedConfig = null
let cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000

export async function getSelfConfig() {
  const now = Date.now()
  if (cachedConfig && now - cacheTime < CACHE_TTL) return cachedConfig

  const token = process.env.YANDEX_SELF_TOKEN
  let rootPath = process.env.YANDEX_SELF_PATH || '/'

  // Убираем хвостовой слэш, чтобы не было //.settings.json
  rootPath = rootPath.replace(/\/+$/, '')
  if (rootPath && !rootPath.startsWith('/')) rootPath = '/' + rootPath

  const settingsPath = `${rootPath}/.settings.json`

  try {
    const res = await yandexFetch(token, '/resources/download', {
      path: `disk:${settingsPath}`,
    })
    const meta = await res.json()

    if (!meta.href) {
      throw new Error('No href in response')
    }

    const fileRes = await fetch(meta.href)
    const text = await fileRes.text()

    const config = JSON.parse(text)

    cachedConfig = {
      contexts: config.contexts || {},
      common: config.common || null,
    }
    cacheTime = now
    return cachedConfig
  } catch (err) {
    console.error('[yandex-self] Failed to load settings', err)
    // Возвращаем пустую конфигурацию, чтобы сервер не падал
    return { contexts: {}, common: null }
  }
}

export function invalidateSelfConfig() {
  cachedConfig = null
  cacheTime = 0
}
