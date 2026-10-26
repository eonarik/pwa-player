// server/src/plugins/yandex-self/routes.js
import { Router } from 'express'
import { login, validateToken, refresh } from './auth.js'
import {
  yandexListResources,
  yandexDownloadHref,
  yandexResourceMeta,
  yandexDownloadText,
  yandexUploadText,
} from '../../shared/yandexApi.js'
import { mapAndFilterItems, normalizePath } from './filter.js'

export const selfRoutes = Router()

// --- Публичные роуты (без проверки JWT) -----------------------------

selfRoutes.post('/auth', async (req, res) => {
  const { ctx, password } = req.body
  try {
    const result = await login(ctx, password)
    res.json(result)
  } catch (err) {
    res.status(401).json({ error: err.message })
  }
})

selfRoutes.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' })

  try {
    const result = await refresh(refreshToken)
    res.json(result)
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// --- Middleware для проверки JWT ------------------------------------

function requireAuth(options = { allowQuery: false }) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization
    let token = authHeader?.split(' ')[1]

    if (!token && options.allowQuery && typeof req.query.token === 'string') {
      token = req.query.token
    }

    const payload = validateToken(token)

    if (!payload) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    req.selfAuth = payload
    next()
  }
}

// Применяем строгую проверку ко всем роутам, кроме /download и /refresh
selfRoutes.use((req, res, next) => {
  if (req.path === '/download' || req.path === '/refresh') return next()
  return requireAuth({ allowQuery: false })(req, res, next)
})

selfRoutes.get('/auth/check', (_req, res) => {
  res.json({ ok: true })
})

// --- Защищенные роуты ------------------------------------------------

selfRoutes.get('/resources', async (req, res) => {
  const { path: rawPath = '/' } = req.query
  const root = process.env.YANDEX_SELF_PATH || '/'

  const { path, cleanRoot } = normalizePath(rawPath, root)
  const allowedFolders = req.selfAuth.allowedFolders

  if (Array.isArray(allowedFolders) && allowedFolders.length === 0) {
    res.status(403).json({ error: 'Доступ запрещён' })
    return
  }

  if (Array.isArray(allowedFolders) && allowedFolders.length > 0 && path !== '/') {
    const isAllowed = allowedFolders.some((f) => {
      const cleanF = f.replace(/\/+$/, '')
      return cleanF === path || cleanF.startsWith(path + '/') || path.startsWith(cleanF + '/')
    })
    if (!isAllowed) {
      res.status(403).json({ error: 'Доступ к этой папке запрещён' })
      return
    }
  }

  try {
    const diskPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`
    const data = await yandexListResources(process.env.YANDEX_SELF_TOKEN, diskPath)

    const items = mapAndFilterItems(data._embedded?.items || [], path, allowedFolders)

    data._embedded = { ...data._embedded, items }
    data.total = items.length
    data.items = items // Для совместимости с фронтендом

    res.json(data)
  } catch (err) {
    console.log(`[yandex-self] List error:`, err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

selfRoutes.get('/download', requireAuth({ allowQuery: true }), async (req, res) => {
  const { path: rawPath = '' } = req.query
  if (!rawPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const root = process.env.YANDEX_SELF_PATH || '/'
  const { path, cleanRoot } = normalizePath(rawPath, root)

  const allowedFolders = req.selfAuth.allowedFolders
  if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
    const isAllowed = allowedFolders.some((f) => {
      const cleanF = f.replace(/\/+$/, '')
      return path === cleanF || path.startsWith(cleanF + '/')
    })
    if (!isAllowed) {
      res.status(403).json({ error: 'Доступ к этой папке запрещён' })
      return
    }
  }

  try {
    const diskPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`

    // 1. Получаем ссылку (с ретраями)
    let href = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        href = await yandexDownloadHref(process.env.YANDEX_SELF_TOKEN, diskPath)
        if (href) break
      } catch (err) {
        // Если файла нет в метаданных — 404
        if (err.status === 404) throw err
        if (attempt === 3) throw err
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    if (!href) {
      res.status(404).json({ error: 'Download link not found' })
      return
    }

    // 2. Скачиваем файл (с ретраями)
    let fileResponse = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      let timeoutId
      try {
        const controller = new AbortController()
        timeoutId = setTimeout(() => controller.abort(), 15000)

        fileResponse = await fetch(href, {
          headers: { Connection: 'close' },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (fileResponse.ok) break

        if (fileResponse.status === 404 || fileResponse.status === 410) {
          res.status(404).json({ error: 'File not found on Yandex Disk' })
          return
        }

        if (fileResponse.status >= 500) throw new Error(`Yandex HTTP ${fileResponse.status}`)
        break
      } catch (err) {
        if (timeoutId) clearTimeout(timeoutId)
        if (attempt === 3) throw err
        await new Promise((r) => setTimeout(r, 1000))
      }
    }

    if (!fileResponse || !fileResponse.ok || !fileResponse.body) {
      res.status(502).json({ error: 'Failed to fetch file from Yandex (Network Error)' })
      return
    }

    const contentType = fileResponse.headers.get('Content-Type') || 'audio/mpeg'
    const contentLength = fileResponse.headers.get('Content-Length')
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'private, max-age=3600')

    const reader = fileResponse.body.getReader()
    const pump = async () => {
      const { done, value } = await reader.read()
      if (done) {
        res.end()
        return
      }
      res.write(value)
      return pump()
    }
    await pump()
  } catch (err) {
    console.error(`[yandex-self] Download error for "${rawPath}":`, err.message)

    if (res.headersSent || res.writableEnded) {
      res.destroy()
      return
    }

    // Обработка специфичных ошибок Яндекса
    if (err.status === 404 || err.name === 'NotFoundError') {
      res.status(404).json({ error: 'File not found' })
      return
    }

    // Сетевые ошибки (fetch failed, ETIMEDOUT, ENETUNREACH)
    if (
      err.cause?.code === 'ETIMEDOUT' ||
      err.cause?.code === 'ENETUNREACH' ||
      err.message === 'fetch failed'
    ) {
      res.status(502).json({ error: 'Network error while fetching from Yandex' })
      return
    }

    res.status(500).json({ error: 'Internal server error' })
  }
})

selfRoutes.get('/text', requireAuth({ allowQuery: true }), async (req, res) => {
  const { path: rawPath = '' } = req.query
  if (!rawPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const root = process.env.YANDEX_SELF_PATH || '/'
  const { path, cleanRoot } = normalizePath(rawPath, root)

  const allowedFolders = req.selfAuth.allowedFolders
  if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
    const isAllowed = allowedFolders.some((f) => {
      const cleanF = f.replace(/\/+$/, '')
      return path === cleanF || path.startsWith(cleanF + '/')
    })
    if (!isAllowed) {
      res.status(403).json({ error: 'Доступ запрещён' })
      return
    }
  }

  try {
    const diskPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`
    const meta = await yandexResourceMeta(process.env.YANDEX_SELF_TOKEN, diskPath)
    const content = await yandexDownloadText(process.env.YANDEX_SELF_TOKEN, diskPath)

    res.json({
      content: content ?? '',
      modified: meta.modified ?? null,
      size: meta.size ?? null,
    })
  } catch (err) {
    console.log(`[yandex-self] Read text error:`, err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

selfRoutes.put('/text', requireAuth({ allowQuery: true }), async (req, res) => {
  const { path: rawPath = '' } = req.query
  if (!rawPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : null
  if (content === null) {
    res.status(400).json({ error: 'content is required' })
    return
  }

  const root = process.env.YANDEX_SELF_PATH || '/'
  const { path, cleanRoot } = normalizePath(rawPath, root)

  const allowedFolders = req.selfAuth.allowedFolders
  if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
    const isAllowed = allowedFolders.some((f) => {
      const cleanF = f.replace(/\/+$/, '')
      return path === cleanF || path.startsWith(cleanF + '/')
    })
    if (!isAllowed) {
      res.status(403).json({ error: 'Доступ запрещён' })
      return
    }
  }

  try {
    const diskPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`
    await yandexUploadText(process.env.YANDEX_SELF_TOKEN, diskPath, content)
    const meta = await yandexResourceMeta(process.env.YANDEX_SELF_TOKEN, diskPath)

    res.json({ ok: true, modified: meta.modified ?? null })
  } catch (err) {
    console.log(`[yandex-self] Write text error:`, err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})
