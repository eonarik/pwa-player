// server/src/plugins/podcasts/routes.js

import { Router } from 'express'

const TIMEOUT = 15_000
const MAX_SIZE = 30 * 1024 * 1024 // 30 МБ — с запасом для больших лент
const ALLOWED = new Set(['http:', 'https:'])

export const podcastsRoutes = Router()

podcastsRoutes.get('/proxy', async (req, res, next) => {
  const raw = typeof req.query.url === 'string' ? req.query.url : ''
  if (!raw) return res.status(400).json({ error: 'url is required' })

  let url
  try {
    url = new URL(raw)
  } catch {
    return res.status(400).json({ error: 'invalid url' })
  }
  if (!ALLOWED.has(url.protocol)) return res.status(400).json({ error: 'only http/https' })

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'User-Agent': 'CUEI/1.0', Accept: '*/*' },
      signal: AbortSignal.timeout(TIMEOUT),
    })
    if (!upstream.ok || !upstream.body) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` })
    }

    const reader = upstream.body.getReader()
    const chunks = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_SIZE) return res.status(413).json({ error: 'too large' })
      chunks.push(value)
    }

    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
    const ct = upstream.headers.get('content-type') || 'application/xml'
    res.setHeader(
      'Content-Type',
      ct.includes('json') ? 'application/json' : 'application/xml; charset=utf-8',
    )
    res.setHeader('Cache-Control', 'public, max-age=600')
    res.send(buffer)
  } catch (err) {
    if (err.name === 'TimeoutError') return res.status(504).json({ error: 'timeout' })
    next(err)
  }
})
