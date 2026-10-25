// server/src/plugins/yandex-self/routes.spec.js
// oxlint-disable vitest/require-mock-type-parameters

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import { selfRoutes } from './routes.js'
import { login } from './auth.js'

vi.mock('./config.js', () => ({
  getSelfConfig: vi.fn(async () => ({
    contexts: {
      common: { password: '', folders: null },
    },
    common: { password: '', folders: null },
  })),
  invalidateSelfConfig: vi.fn(),
}))

function makeRequest(app, method, path, { token } = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, '127.0.0.1', async () => {
      const port = server.address().port
      try {
        const headers = {}
        if (token) headers.Authorization = `Bearer ${token}`

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
    app.use('/api/yandex-self', selfRoutes)
  })

  it('401 без токена', async () => {
    const res = await makeRequest(app, 'GET', '/api/yandex-self/auth/check')
    expect(res.status).toBe(401)
    expect(res.data).toEqual({ error: 'Unauthorized' })
  })

  it('401 с невалидным токеном', async () => {
    const res = await makeRequest(app, 'GET', '/api/yandex-self/auth/check', {
      token: 'garbage.signature',
    })
    expect(res.status).toBe(401)
  })

  it('200 с валидным токеном', async () => {
    // login() читает конфиг через getSelfConfig(), который замокан.
    // common без пароля → login('common', '') вернёт accessToken.
    const { accessToken } = await login('common', '')

    const res = await makeRequest(app, 'GET', '/api/yandex-self/auth/check', {
      token: accessToken,
    })
    expect(res.status).toBe(200)
    expect(res.data).toEqual({ ok: true })
  })
})
