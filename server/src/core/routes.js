// server/src/core/routes.js

import { Router } from 'express'
import { passport } from './passport.js'

export const coreRouter = Router()

/**
 * GET /api/auth/yandex/start
 * Редирект на Яндекс OAuth (PKCE S256, state).
 */
coreRouter.get('/yandex/start', passport.authenticate('yandex', { session: true }))

/**
 * GET /api/auth/yandex/callback
 * Callback от Яндекса. Passport обменивает code на токены.
 */
coreRouter.get(
  '/yandex/callback',
  passport.authenticate('yandex', {
    session: true,
    failureRedirect: `${process.env.FRONTEND_ORIGIN ?? ''}/?auth=failed`,
  }),
  (req, res) => {
    // Успех — редирект на фронт
    res.redirect(`${process.env.FRONTEND_ORIGIN ?? ''}/?auth=ok`)
  },
)

/**
 * GET /api/auth/me
 * Текущий пользователь (только факт авторизации, без токенов).
 */
coreRouter.get('/me', (req, res) => {
  if (!req.user?.accessToken) {
    res.json({ authenticated: false })
    return
  }
  res.json({
    authenticated: true,
    expiresAt: req.user.expiresAt ?? null,
  })
})

/**
 * POST /api/auth/logout
 * Уничтожает сессию.
 */
coreRouter.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err)
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr)
      res.clearCookie('connect.sid')
      res.json({ ok: true })
    })
  })
})
