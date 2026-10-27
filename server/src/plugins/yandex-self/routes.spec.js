// server/src/plugins/yandex-self/routes.spec.js
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { selfRoutes } from './routes.js'
import { login } from './auth.js'

// Мокаем конфиг (чтобы не ходить в Яндекс.Диск)
vi.mock('./config.js', () => ({
  getSelfConfig: vi.fn(async () => ({
    contexts: {
      common: { password: '', folders: null },
    },
    common: { password: '', folders: null },
  })),
  invalidateSelfConfig: vi.fn(),
}))

// Мокаем express-session (просто фейковая сессия в памяти для теста)
function makeRequest(app, method, path, { session } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port
      try {
        const headers = {}

        // Если передали сессию, имитируем cookie (но express-session требует реальную cookie)
        // Поэтому мы просто подставим сессию прямо в req через middleware (см. ниже)

        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          headers,
        })
        const data = await res.json().catch(() => null)
        server.close(() => resolve({ status: res.status, data }))
      } catch (err) {
        server.close(() => reject(err))
      }
    })
  })
}

describe('yandex-self /auth/check', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())

    // Имитируем middleware сессии: если есть заголовок X-Test-Session,
    // подставляем объект в req.session
    app.use((req, _res, next) => {
      const sessionHeader = req.headers['x-test-session']
      if (sessionHeader) {
        req.session = { selfAuth: JSON.parse(sessionHeader) }
      } else {
        req.session = {}
      }
      next()
    })

    app.use('/api/yandex-self', selfRoutes)
  })

  it('401 без сессии', async () => {
    const res = await makeRequest(app, 'GET', '/api/yandex-self/auth/check')
    expect(res.status).toBe(401)
    expect(res.data).toEqual({ error: 'Unauthorized' })
  })

  it('200 с валидной сессией', async () => {
    // Генерируем объект сессии через login (он возвращает { userId, allowedFolders })
    const authData = await login('common', '')

    const res = await new Promise((resolve, reject) => {
      const server = http.createServer(app)
      server.listen(0, '127.0.0.1', async () => {
        const port = server.address().port
        try {
          const response = await fetch(`http://127.0.0.1:${port}/api/yandex-self/auth/check`, {
            method: 'GET',
            headers: {
              // Передаем сессию через кастомный заголовок (наш middleware выше ее прочитает)
              'X-Test-Session': JSON.stringify(authData),
            },
          })
          const data = await response.json().catch(() => null)
          server.close(() => resolve({ status: response.status, data }))
        } catch (err) {
          server.close(() => reject(err))
        }
      })
    })

    expect(res.status).toBe(200)
    expect(res.data).toEqual({ ok: true })
  })
})
