// server/src/plugins/yandex-self/routes.js
import { Router } from 'express'
import { login, validateToken } from './auth.js'
import {
  yandexListResources,
  yandexDownloadHref,
  yandexResourceMeta,
  yandexDownloadText,
  yandexUploadText,
} from '../../shared/yandexApi.js'

export const selfRoutes = Router()

selfRoutes.post('/auth', async (req, res) => {
  const { ctx, password } = req.body
  try {
    const result = await login(ctx, password)
    res.json(result)
  } catch (err) {
    res.status(401).json({ error: err.message })
  }
})

// Выносим middleware в функцию, чтобы можно было применить её с опциями
function requireAuth(options = { allowQuery: false }) {
  return (req, res, next) => {
    // 1. Проверяем заголовок
    const authHeader = req.headers.authorization
    let token = authHeader?.split(' ')[1]

    // 2. Если разрешено — проверяем query (для <audio>)
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

// Применяем строгую проверку ко всем роутам, кроме /download
selfRoutes.use((req, res, next) => {
  // Пропускаем /download без проверки здесь, он проверит сам
  if (req.path === '/download') return next()
  return requireAuth({ allowQuery: false })(req, res, next)
})

selfRoutes.get('/resources', async (req, res) => {
  let { path = '/' } = req.query

  path = path.replace(/^disk:/, '')
  if (!path.startsWith('/')) path = '/' + path
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)

  const token = process.env.YANDEX_SELF_TOKEN
  const root = process.env.YANDEX_SELF_PATH || '/'
  let cleanRoot = root.replace(/\/+$/, '')
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot

  if (cleanRoot && path.startsWith(cleanRoot)) {
    path = path.slice(cleanRoot.length)
    if (!path.startsWith('/')) path = '/' + path
  }
  if (path === '') path = '/'

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

    const data = await yandexListResources(token, diskPath)

    let items = (data._embedded?.items || []).map((item) => ({
      ...item,
      isAudio: item.type === 'file' && /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma)$/i.test(item.name),
    }))

    if (Array.isArray(allowedFolders) && allowedFolders.length > 0) {
      items = items.filter((item) => {
        const itemPath = path === '/' ? '/' + item.name : path + '/' + item.name
        return allowedFolders.some((f) => {
          const cleanF = f.replace(/\/+$/, '')
          return (
            cleanF === itemPath ||
            cleanF.startsWith(itemPath + '/') ||
            itemPath.startsWith(cleanF + '/')
          )
        })
      })
    }

    data._embedded = { ...data._embedded, items }
    data.total = items.length

    res.json(data)
  } catch (err) {
    console.log(`[yandex-self] Error:`, err.message)
    res.status(500).json({ error: err.message })
  }
})

// Отдельный роут для скачивания, который разрешает токен в query
selfRoutes.get('/download', requireAuth({ allowQuery: true }), async (req, res) => {
  let { path = '' } = req.query
  if (!path) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  path = path.replace(/^disk:/, '')
  if (!path.startsWith('/')) path = '/' + path

  const token = process.env.YANDEX_SELF_TOKEN
  const root = process.env.YANDEX_SELF_PATH || '/'
  let cleanRoot = root.replace(/\/+$/, '')
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot

  if (cleanRoot && path.startsWith(cleanRoot)) {
    path = path.slice(cleanRoot.length)
    if (!path.startsWith('/')) path = '/' + path
  }

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
    const href = await yandexDownloadHref(token, diskPath)

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
    res.status(500).json({ error: 'Internal server error' })
  }
})

selfRoutes.get('/text', requireAuth({ allowQuery: true }), async (req, res) => {
  let { path = '' } = req.query
  if (!path) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  path = path.replace(/^disk:/, '')
  if (!path.startsWith('/')) path = '/' + path

  const token = process.env.YANDEX_SELF_TOKEN
  const root = process.env.YANDEX_SELF_PATH || '/'
  let cleanRoot = root.replace(/\/+$/, '')
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot

  if (cleanRoot && path.startsWith(cleanRoot)) {
    path = path.slice(cleanRoot.length)
    if (!path.startsWith('/')) path = '/' + path
  }

  // Проверка прав
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
    const meta = await yandexResourceMeta(token, diskPath)
    const content = await yandexDownloadText(token, diskPath)

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

// PUT /text
selfRoutes.put('/text', requireAuth({ allowQuery: true }), async (req, res) => {
  let { path = '' } = req.query
  if (!path) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : null
  if (content === null) {
    res.status(400).json({ error: 'content is required' })
    return
  }

  path = path.replace(/^disk:/, '')
  if (!path.startsWith('/')) path = '/' + path

  const token = process.env.YANDEX_SELF_TOKEN
  const root = process.env.YANDEX_SELF_PATH || '/'
  let cleanRoot = root.replace(/\/+$/, '')
  if (cleanRoot && !cleanRoot.startsWith('/')) cleanRoot = '/' + cleanRoot

  if (cleanRoot && path.startsWith(cleanRoot)) {
    path = path.slice(cleanRoot.length)
    if (!path.startsWith('/')) path = '/' + path
  }

  // Проверка прав
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
    await yandexUploadText(token, diskPath, content)
    const meta = await yandexResourceMeta(token, diskPath)

    res.json({ ok: true, modified: meta.modified ?? null })
  } catch (err) {
    console.log(`[yandex-self] Write text error:`, err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})
