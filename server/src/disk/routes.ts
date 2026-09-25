// server/src/disk/routes.ts

import { Router } from 'express'
import { yandexFetch, YandexApiError } from '../yandex/client.js'

export const diskRouter = Router()

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.opus', '.wma'])

function isAudioFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return AUDIO_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

interface YandexResource {
  path: string
  name: string
  type: 'dir' | 'file'
  size?: number
  mime_type?: string
  media_type?: string
  created?: string
  modified?: string
}

interface YandexResourcesResponse {
  path?: string
  _embedded?: {
    path?: string
    items: YandexResource[]
    total: number
    limit: number
    offset: number
  }
}

/**
 * GET /api/disk/resources?path=/Music
 * Список файлов и папок. Отдаёт «сырой» ответ Яндекса,
 * но добавляет поле `isAudio` к каждому файлу.
 */
diskRouter.get('/resources', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path : '/'

  try {
    const response = await yandexFetch('/resources', {
      path,
      limit: 1000,
      sort: 'name',
    })
    const data = (await response.json()) as YandexResourcesResponse

    // Обогащаем: помечаем аудиофайлы
    const items = data._embedded?.items ?? []
    const enriched = items.map((item) => ({
      ...item,
      isAudio: item.type === 'file' && isAudioFile(item.name),
    }))

    res.json({
      path: data._embedded?.path ?? path,
      total: data._embedded?.total ?? 0,
      items: enriched,
    })
  } catch (err) {
    handleError(err, res)
  }
})

/**
 * GET /api/disk/download?path=/Music/track.mp3
 * Стримит файл из Яндекс.Диска.
 */
diskRouter.get('/download', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path : ''

  if (!path) {
    res.status(400).json({ error: 'path is required' })
    return
  }

  try {
    const metaResponse = await yandexFetch('/resources/download', { path })
    const meta = (await metaResponse.json()) as { href?: string }

    if (!meta.href) {
      res.status(404).json({ error: 'Download link not found' })
      return
    }

    const fileResponse = await fetch(meta.href, {
      headers: {
        Authorization: `OAuth ${process.env.YANDEX_TOKEN}`,
      },
    })

    if (!fileResponse.ok || !fileResponse.body) {
      res.status(fileResponse.status).json({ error: 'Failed to fetch file' })
      return
    }

    const contentType = fileResponse.headers.get('Content-Type') || 'audio/mpeg'
    const contentLength = fileResponse.headers.get('Content-Length')
    res.setHeader('Content-Type', contentType)
    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const reader = fileResponse.body.getReader()
    const pump = async (): Promise<void> => {
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

function handleError(err: unknown, res: import('express').Response): void {
  if (err instanceof YandexApiError) {
    console.error(`[disk] Yandex API error ${err.status}: ${err.message}`)
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('[disk] unexpected error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
