// server/src/auth/routes.ts

import { Router } from 'express'
import type { Request } from 'express'
import { loadSettings } from '../settings/client.js'
import { createToken, validateToken } from './jwt.js'

export const authRouter = Router()

authRouter.post('/auth', async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  const settings = await loadSettings()
  if (!settings) {
    res.status(503).json({ ok: false, error: 'Server not configured' })
    return
  }

  if (password !== settings.password) {
    res.status(401).json({ ok: false, error: 'Invalid password' })
    return
  }

  const token = createToken()
  res.json({ ok: true, token })
})

authRouter.get('/auth/check', (req, res) => {
  const token = extractToken(req)
  if (!token || !validateToken(token)) {
    res.status(401).json({ ok: false })
    return
  }
  res.json({ ok: true })
})

/** Извлекает токен из заголовка или query-параметра */
export function extractToken(req: Request): string | null {
  // 1. Заголовок Authorization: Bearer <token>
  const header = req.headers.authorization
  if (header) {
    const match = header.match(/^Bearer\s+(.+)$/)
    if (match?.[1]) return match[1]
  }

  // 2. Query-параметр (для <audio src>, который не передаёт заголовки)
  const queryToken = req.query.token
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken
  }

  return null
}
