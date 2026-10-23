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
  } catch (err) {
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
    const href = await yandexDownloadHref(process.env.YANDEX_SELF_TOKEN, diskPath)

    if (!href) {
      res.status(404).json({ error: 'Download link not found' })
      return
    }

    const fileResponse = await fetch(href)
    if (!fileResponse.ok || !fileResponse.body) {
      res.status(fileResponse.status).json({ error: 'Failed to fetch file' })
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
    console.log(`[yandex-self] Download error:`, err.message)

    // Заголовки уже ушли (частично отданный файл, обрыв клиентом) —
    // отвечать нельзя, только рвём соединение.
    if (res.headersSent || res.writableEnded) {
      res.destroy()
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
