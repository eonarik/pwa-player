// server/src/disk/routes.ts

import { Router } from 'express'
import { yandexFetch, YandexApiError } from '../yandex/client.js'
import { checkAccess } from '../middleware/requireAuth.js'
import { resolveDiskPath, toClientPath } from './paths.js'
import { filterPublicItems } from './filter.js'

export const diskRouter = Router()

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma'])

function isAudioFile(name) {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return AUDIO_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

diskRouter.get('/resources', async (req, res) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : '/'

  const access = await checkAccess(req, clientPath)
  if (!access.allowed || !access.settings) {
    res.status(401).json({ error: 'Authorization required' })
    return
  }

  // Не авторизован: пускаем только корень (с фильтрацией) и публичные папки
  if (!access.authenticated) {
    const isRoot = clientPath === '/' || clientPath === '' || clientPath === 'disk:/'
    if (!isRoot && !access.isPublic) {
      res.status(401).json({ error: 'Authorization required' })
      return
    }
  }

  const path = resolveDiskPath(clientPath)

  try {
    const response = await yandexFetch('/resources', {
      path,
      limit: 1000,
      sort: 'name',
    })
    const data = await response.json()

    let items = (data._embedded?.items ?? []).map((item) => ({
      ...item,
      path: toClientPath(item.path),
      isAudio: item.type === 'file' && isAudioFile(item.name),
    }))

    // Не авторизован — фильтруем по публичным папкам
    if (!access.authenticated) {
      items = filterPublicItems(items, clientPath, access.settings.publicFolders)
    }

    res.json({
      path: clientPath,
      total: items.length,
      items,
    })
  } catch (err) {
    handleError(err, res)
  }
})
diskRouter.get('/download', async (req, res) => {
  const clientPath = typeof req.query.path === 'string' ? req.query.path : ''
  if (!clientPath) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  const access = await checkAccess(req, clientPath)
  if (!access.allowed) {
    res.status(401).json({ error: 'Authorization required' })
    return
  }

  // Не авторизован → проверяем, что путь публичен
  if (!access.authenticated && !access.isPublic) {
    res.status(401).json({ error: 'Authorization required' })
    return
  }

  const path = resolveDiskPath(clientPath)

  try {
    const metaResponse = await yandexFetch('/resources/download', { path })
    const meta = await metaResponse.json()

    if (!meta.href) {
      res.status(404).json({ error: 'Download link not found' })
      return
    }

    const fileResponse = await fetch(meta.href, {
      headers: { Authorization: `OAuth ${process.env.YANDEX_TOKEN}` },
    })

    if (!fileResponse.ok || !fileResponse.body) {
      res.status(fileResponse.status).json({ error: 'Failed to fetch file' })
      return
    }

    const contentType = fileResponse.headers.get('Content-Type') || 'audio/mpeg'
    const contentLength = fileResponse.headers.get('Content-Length')
    res.setHeader('Content-Type', contentType)
    if (contentLength) res.setHeader('Content-Length', contentLength)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

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
    handleError(err, res)
  }
})

function handleError(err, res) {
  if (err instanceof YandexApiError) {
    console.error(`[disk] Yandex API error ${err.status}: ${err.message}`)
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[disk] unexpected error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
