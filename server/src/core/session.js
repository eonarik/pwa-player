// server/src/core/session.js

import session from 'express-session'
import fileStoreFactory from 'session-file-store'

const FileStore = fileStoreFactory(session)

// Папка для хранения сессий.
// Важно: она должна сохраняться между деплоями (не удаляться в deploy.yml).
const SESSION_STORE_PATH = process.env.SESSION_STORE_PATH || './.sessions'

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  // Не создавать сессию, пока пользователь не авторизуется.
  // Это избавит от мусорных файлов от ботов.
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  },
  store: new FileStore({
    path: SESSION_STORE_PATH,
    ttl: 30 * 24 * 60 * 60, // 30 дней в секундах (для авто-очистки)
    retries: 2,
    reapInterval: 3600, // Раз в час проверять протухшие сессии
    logFn: () => {}, // Отключаем спам в консоли при каждом запросе
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
