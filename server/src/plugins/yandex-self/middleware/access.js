// server/src/plugins/yandex-self/middleware/access.js

import { normalizePath } from '../filter.js';

/**
 * Проверяет, что `path` (уже нормализованный) разрешён для текущего selfAuth.
 * Возвращает true/false. Не бросает.
 *
 * Семантика (как в /resources и /download):
 * - allowedFolders === null → всё разрешено.
 * - allowedFolders === [] → ничего не разрешено (кроме корня `/`).
 * - иначе → path должен быть внутри одного из allowedFolders
 *   (равен, внутри, или родитель).
 */
export function isPathAllowed(path, allowedFolders) {
  if (!Array.isArray(allowedFolders)) return true;
  if (allowedFolders.length === 0) return path === '/';

  return allowedFolders.some((f) => {
    const cleanF = f.replace(/\/+$/, '').replace(/^\/+/, '');
    const cleanP = path.replace(/^\/+/, '');
    return cleanP === cleanF || cleanP.startsWith(cleanF + '/') || cleanF.startsWith(cleanP + '/');
  });
}

/**
 * Извлекает selfAuth из req, нормализует путь и проверяет доступ.
 * Если что-то не так — сам отвечает 400/403 и возвращает null.
 * Иначе возвращает { path, cleanRoot, fullPath }.
 *
 * `fullPath` — полный путь на Диске (`disk:<cleanRoot>/<path>`), готовый для API.
 *
 * Пример:
 *   const ctx = resolveRequestPath(req, res, req.query.path);
 *   if (!ctx) return;
 *   await yandexXxx(ctx.fullPath);
 */
export function resolveRequestPath(req, res, rawPath) {
  if (!rawPath || typeof rawPath !== 'string') {
    res.status(400).json({ error: 'path is required' });
    return null;
  }

  const root = process.env.YANDEX_SELF_PATH || '/';
  const { path, cleanRoot } = normalizePath(rawPath, root);

  if (!isPathAllowed(path, req.selfAuth?.allowedFolders)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return null;
  }

  const fullPath = path === '/' ? `disk:${cleanRoot}` : `disk:${cleanRoot}${path}`;
  return { path, cleanRoot, fullPath };
}

/**
 * Возвращает полный путь на Диске для пары (parentPath, name).
 * Используется при создании папки / загрузке файла.
 */
export function joinDiskPath(cleanRoot, parentPath, name) {
  if (parentPath === '/') return `disk:${cleanRoot}/${name}`;
  return `disk:${cleanRoot}${parentPath}/${name}`;
}
