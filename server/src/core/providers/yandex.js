// server/src/core/providers/yandex.js

import { Strategy as OAuth2Strategy } from 'passport-oauth2'
import { yandexResourceMeta } from '../../shared/yandexApi.js'

/**
 * Стратегия Яндекс.Диска на базе passport-oauth2.
 * PKCE S256 включён (pkce: true).
 * Право: cloud_api:disk.app_folder — доступ только к app:/.
 */
export const yandexStrategy = new OAuth2Strategy(
  {
    authorizationURL: 'https://oauth.yandex.ru/authorize',
    tokenURL: 'https://oauth.yandex.ru/token',
    clientID: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    callbackURL: process.env.YANDEX_REDIRECT_URI,
    scope: 'cloud_api:disk.app_folder',
    pkce: true,
    state: true,
    store: true,
  },
  async (accessToken, refreshToken, params, _profile, done) => {
    try {
      // Проверяем, что токен работает: запрашиваем метаданные app:/
      // (при первом запросе Яндекс создаст папку приложения, если её нет)
      await yandexResourceMeta(accessToken, 'app:/')

      return done(null, {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + (params.expires_in ?? 0) * 1000,
      })
    } catch (err) {
      return done(err)
    }
  },
)

/**
 * Сохраняем в сессии весь объект пользователя (токены + expiresAt).
 * Passport сохранит его в req.session.passport.user.
 */
export function serializeUser(user, done) {
  done(null, user)
}

export function deserializeUser(obj, done) {
  done(null, obj)
}
