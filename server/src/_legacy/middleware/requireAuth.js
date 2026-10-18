// server/src/middleware/requireAuth.ts

import { validateToken } from '../auth/jwt.js'
import { extractToken } from '../auth/routes.js'
import { isPathPublic, loadSettings } from '../settings/client.js'

/**
 * Проверяет доступ к запрошенному пути.
 * Возвращает результат, по которому роут принимает решение:
 * - allowed: false → 401
 * - allowed: true + authenticated: false → отдаём данные с фильтрацией
 * - allowed: true + authenticated: true → отдаём всё
 */
export async function checkAccess(req, path) {
  const settings = await loadSettings()
  if (!settings) {
    return { allowed: false, authenticated: false, isPublic: false, settings: null }
  }

  const token = extractToken(req)
  const authenticated = Boolean(token && validateToken(token))
  const isPublic = isPathPublic(path, settings.publicFolders)

  // Авторизован → всё разрешено
  if (authenticated) {
    return { allowed: true, authenticated: true, isPublic, settings }
  }

  // Не авторизован. Разрешаем только если есть публичные папки.
  if (settings.publicFolders.length > 0) {
    return { allowed: true, authenticated: false, isPublic, settings }
  }

  // Нет публичных и не авторизован → 401
  return { allowed: false, authenticated: false, isPublic: false, settings }
}
