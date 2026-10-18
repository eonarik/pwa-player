// server/src/plugins/yandex/routes.js

import { Router } from 'express'
import { requireSession } from '../../core/index.js'
import { YandexApiError } from '../../shared/errors.js'
import { listResources, getDownloadHref, getFileMeta, uploadText } from './service.js'

export const yandexRoutes = Router()

yandexRoutes.use(requireSession)

yandexRoutes.get('/resources', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '/'

  try {
    const result = await listResources(req.user.accessToken, clientPath)
    res.json(result)
  } catch (err) {
    next(err)
  }
})

yandexRoutes.get('/download', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : ''
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  try {
    const href = await getDownloadHref(req.user.accessToken, clientPath)
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
    next(err)
  }
})

yandexRoutes.get('/text', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : ''
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  try {
    const meta = await getFileMeta(req.user.accessToken, clientPath)
    // Текстовое содержимое — через download href (тот же механизм, что и аудио)
    const href = await getDownloadHref(req.user.accessToken, clientPath)
    let content = ''
    if (href) {
      const fileRes = await fetch(href)
      if (fileRes.ok) content = await fileRes.text()
    }

    res.json({
      content,
      modified: meta.modified ?? null,
      size: meta.size ?? null,
    })
  } catch (err) {
    next(err)
  }
})

yandexRoutes.put('/text', async (req, res, next) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : ''
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : null
  if (content === null) {
    res.status(400).json({ error: 'content is required' })
    return
  }

  try {
    const meta = await uploadText(req.user.accessToken, clientPath, content)
    res.json({ ok: true, modified: meta.modified ?? null })
  } catch (err) {
    next(err)
  }
})

// Централизованный error handler для плагина
yandexRoutes.use((err, _req, res, _next) => {
  if (err instanceof YandexApiError) {
    const status = Number.isFinite(err.status) ? err.status : 500
    console.error(`[yandex] API error ${status}: ${err.message}`)
    res.status(status).json({ error: err.message })
    return
  }
  console.error('[yandex] unexpected error:', err)
  res.status(500).json({ error: 'Internal server error' })
})
