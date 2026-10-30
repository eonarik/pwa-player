// server/src/core/middleware/requireSession.js

import { AuthError } from '../../shared/errors.js';
import { ensureFreshToken } from '../session.js';

/**
 * Пропускает только авторизованные запросы (есть Yandex access token в req.user).
 * Обновляет токен, если истёк.
 */
export async function requireSession(req, _res, next) {
  if (!req.user?.accessToken) {
    return next(new AuthError('Yandex Disk not connected'));
  }

  const fresh = await ensureFreshToken(req);
  if (!fresh) {
    return next(new AuthError('Yandex token expired, please reconnect'));
  }

  next();
}
