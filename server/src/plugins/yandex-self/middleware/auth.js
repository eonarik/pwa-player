// server/src/plugins/yandex-self/middleware/auth.js

/**
 * Пропускает только запросы с валидной self-сессией.
 * Кладёт результат в req.selfAuth.
 */
export function requireAuth(req, res, next) {
  if (!req.session?.selfAuth) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  req.selfAuth = req.session.selfAuth;
  next();
}
