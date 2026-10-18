// server/src/core/session.js

import session from 'express-session'
import memorystore from 'memorystore'

const MemoryStore = memorystore(session)

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  },
  store: new MemoryStore({
    checkPeriod: 24 * 60 * 60 * 1000, // чистим протухшие раз в сутки
  }),
})

/**
 * Обновляет access-токен, если истёк.
 * Работает с req.user (Passport), а не с req.session.
 *
 * @param {import('express').Request} req
 * @returns {Promise<boolean>} — true, если токен валиден (или обновлён)
 */
export async function ensureFreshToken(req) {
  const user = req.user
  if (!user?.accessToken) return false

  if (!user.expiresAt) return true
  if (Date.now() < user.expiresAt - 60_000) return true

  if (!user.refreshToken) return false

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
      client_id: process.env.YANDEX_CLIENT_ID,
      client_secret: process.env.YANDEX_CLIENT_SECRET,
    })

    const res = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!res.ok) return false

    const data = await res.json()
    user.accessToken = data.access_token
    if (data.refresh_token) user.refreshToken = data.refresh_token
    user.expiresAt = Date.now() + (data.expires_in ?? 0) * 1000

    return true
  } catch {
    return false
  }
}
